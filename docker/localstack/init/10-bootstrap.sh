#!/bin/bash
# Creates the local AWS resources the app expects (same names as deployed stages, with stage "local").
set -euo pipefail
STAGE="${STAGE:-local}"

for bucket in "twelveten-${STAGE}-site" "twelveten-${STAGE}-media"; do
  awslocal s3api head-bucket --bucket "$bucket" 2>/dev/null || awslocal s3api create-bucket --bucket "$bucket" \
    --create-bucket-configuration LocationConstraint="${AWS_DEFAULT_REGION}" >/dev/null
done

# Browsers upload straight to the media bucket with presigned PUTs.
awslocal s3api put-bucket-cors --bucket "twelveten-${STAGE}-media" --cors-configuration '{
  "CORSRules": [{"AllowedOrigins": ["*"], "AllowedMethods": ["GET", "PUT", "HEAD"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3000}]
}'

param() {
  awslocal ssm get-parameter --name "$1" >/dev/null 2>&1 || \
    awslocal ssm put-parameter --name "$1" --type SecureString --value "$2" >/dev/null
}
param "/twelveten/${STAGE}/better-auth-secret" "local-dev-secret-$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"
param "/twelveten/${STAGE}/db-password" "twelveten"
param "/twelveten/${STAGE}/origin-verify-secret" "local-origin-verify-secret-0000"

echo "LocalStack bootstrap complete for stage ${STAGE}"
