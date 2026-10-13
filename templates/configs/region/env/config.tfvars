# Non-secret environment settings. Generated into infra/terraform/configs/<region>/<env>/config.tfvars
# Template placeholders: __TF_VAR_region__, __TF_infra_env__, __TF_VAR_project_name__

aws_region   = "__TF_VAR_region__"
project_name = "__TF_VAR_project_name__"
environment  = "__TF_infra_env__"
log_retention_days = 14

# Optional: Medallia OAuth token URL for outbound status callbacks
# medallia_oauth_token_url = "https://tenant.example.apis.medallia.com/oauth/token"
