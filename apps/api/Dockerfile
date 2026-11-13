# Lambda container image for the API (`lambda.handler`), migrations (`migrate.handler`)
# and the page rebuild job (`rebuild.handler`). Build context: the repository root.

FROM public.ecr.aws/docker/library/node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace apps/api --include-workspace-root --ignore-scripts --no-audit --no-fund
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN cd apps/api && node build.mjs

# CA bundle for verifying the RDS TLS certificate.
ADD https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /opt/rds-ca.pem

FROM public.ecr.aws/lambda/nodejs:22
ENV NODE_OPTIONS=--enable-source-maps \
    DATABASE_SSL=true \
    DATABASE_SSL_CA_FILE=/opt/rds-ca.pem \
    DATABASE_POOL_MAX=1
COPY --from=build /opt/rds-ca.pem /opt/rds-ca.pem
COPY --from=build /repo/apps/api/dist/ ${LAMBDA_TASK_ROOT}/
CMD ["lambda.handler"]
