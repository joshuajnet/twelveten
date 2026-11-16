#!/usr/bin/env bash
# One-time: delete what's left of the old `staging` stage, run BY HAND (Claude Code is denied deletes).
# Refuses to delete anything unless prod already holds the files and the data.
#   bash scripts/cleanup-staging.sh
set -euo pipefail
export AWS_PROFILE=twelveten AWS_REGION=us-east-2
unset AWS_ENDPOINT_URL AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY

STAGING_MEDIA=twelveten-staging-mediabucket-sr0wid6esgrr
PROD_MEDIA=$(aws cloudformation describe-stacks --stack-name twelveten-prod \
  --query "Stacks[0].Outputs[?OutputKey=='MediaBucketName'].OutputValue" --output text)

count() { aws s3 ls "s3://$1/media/$2/" --recursive --summarize | awk '/Total Objects/ {print $3}'; }

echo "== Check prod has everything staging had"
for p in images docs derived uploads; do
  s=$(count "$STAGING_MEDIA" "$p"); d=$(count "$PROD_MEDIA" "$p")
  echo "  media/$p: staging $s, prod $d"
  if [ "${d:-0}" -lt "${s:-0}" ]; then echo "STOP: prod is missing files in media/$p"; exit 1; fi
done
PROD_URL="https://$(aws cloudformation describe-stacks --stack-name twelveten-prod \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionDomain'].OutputValue" --output text)"
exhibitions=$(curl -fsS "$PROD_URL/api/exhibitions" | python3 -I -c 'import json,sys
d=json.load(sys.stdin); print(len(d.get("items", d) if isinstance(d, dict) else d))' || echo 0)
echo "  prod database: $exhibitions exhibitions served at $PROD_URL"
[ "$exhibitions" -gt 0 ] || { echo "STOP: prod's database has no content"; exit 1; }

echo
echo "This deletes, permanently:"
aws s3api list-buckets --query 'Buckets[?starts_with(Name, `twelveten-staging-`)].Name' --output text | tr '\t' '\n' | sed 's/^/  bucket   /'
aws rds describe-db-snapshots --snapshot-type manual --query 'DBSnapshots[?starts_with(DBSnapshotIdentifier, `twelveten-staging-`)].DBSnapshotIdentifier' --output text | tr '\t' '\n' | sed 's/^/  snapshot /'
echo "  secrets  /twelveten/staging/{better-auth-secret,db-password,origin-verify-secret}"
echo "  images   ECR serverless-twelveten-staging"
read -r -p "Type DELETE STAGING to continue: " answer
[ "$answer" = "DELETE STAGING" ] || { echo "Cancelled."; exit 1; }

empty_bucket() {  # every object version and delete marker
  while :; do
    batch=$(aws s3api list-object-versions --bucket "$1" --max-items 1000 --output json | python3 -I -c 'import json,sys
d=json.load(sys.stdin); o=[{"Key":v["Key"],"VersionId":v["VersionId"]} for v in (d.get("Versions") or [])+(d.get("DeleteMarkers") or [])]
print(json.dumps({"Objects":o,"Quiet":True}) if o else "")')
    [ -z "$batch" ] && return 0
    aws s3api delete-objects --bucket "$1" --delete "$batch" >/dev/null
  done
}
for b in $(aws s3api list-buckets --query 'Buckets[?starts_with(Name, `twelveten-staging-`)].Name' --output text); do
  empty_bucket "$b"; aws s3api delete-bucket --bucket "$b"; echo "deleted bucket $b"
done
for s in $(aws rds describe-db-snapshots --snapshot-type manual --query 'DBSnapshots[?starts_with(DBSnapshotIdentifier, `twelveten-staging-`)].DBSnapshotIdentifier' --output text); do
  aws rds delete-db-snapshot --db-snapshot-identifier "$s" >/dev/null; echo "deleted snapshot $s"
done
aws ssm delete-parameters --names /twelveten/staging/better-auth-secret /twelveten/staging/db-password /twelveten/staging/origin-verify-secret >/dev/null && echo "deleted staging secrets"
aws ecr delete-repository --repository-name serverless-twelveten-staging --force >/dev/null && echo "deleted ECR repository"
rm -f "$(dirname "$0")/../apps/api/config.staging.yml"
echo "Staging cleanup done."
