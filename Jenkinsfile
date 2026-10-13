pipeline {
  agent any

  parameters {
    choice(
      name: 'ENVIRONMENT',
      choices: ['dev', 'staging', 'prod'],
      description: 'Target deployment environment'
    )
    string(
      name: 'AWS_REGION',
      defaultValue: 'us-east-1',
      description: 'AWS region for Terraform and Lambda deployment'
    )
    string(
      name: 'PROJECT_NAME',
      defaultValue: 'distribution-webhook',
      description: 'Project name prefix used by Terraform resources'
    )
    booleanParam(
      name: 'RUN_DEPLOY',
      defaultValue: false,
      description: 'Run Terraform apply, Lambda deploy, and smoke tests'
    )
    booleanParam(
      name: 'BUILD_MOBILE',
      defaultValue: false,
      description: 'Submit EAS mobile builds (requires EXPO_TOKEN credential)'
    )
    booleanParam(
      name: 'RUN_SMOKE_TEST',
      defaultValue: true,
      description: 'Run post-deploy webhook auth-check smoke test'
    )
  }

  environment {
    NODE_VERSION = '22'
    AWS_DEFAULT_REGION = "${params.AWS_REGION}"
    PROJECT_NAME = "${params.PROJECT_NAME}"
    DEPLOY_ENV = "${params.ENVIRONMENT}"
    TF_IN_AUTOMATION = 'true'
    TF_INPUT = 'false'
    TF_VAR_region = "${params.AWS_REGION}"
    TF_infra_env = "${params.ENVIRONMENT}"
    TF_VAR_project_name = "${params.PROJECT_NAME}"
    TF_workspace = "${params.AWS_REGION}-${params.ENVIRONMENT}"
  }

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '10'))
    timeout(time: 90, unit: 'MINUTES')
  }

  stages {
    stage('Initialize') {
      steps {
        script {
          def branch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
          env.IS_DEPLOY_BRANCH = (
            branch == 'main' ||
            branch == 'master' ||
            branch.endsWith('/main') ||
            branch.endsWith('/master')
          ).toString()

          if (params.RUN_DEPLOY && env.IS_DEPLOY_BRANCH != 'true') {
            error('Deployments are only allowed from main/master. Set RUN_DEPLOY=false for CI-only builds.')
          }
        }
        sh 'chmod +x scripts/*.sh scripts/lib/*.sh 2>/dev/null || chmod +x scripts/*.sh'
      }
    }

    stage('Verify Toolchain') {
      steps {
        sh '''
          set -e
          node --version
          npm --version
          terraform version
          aws --version
        '''
      }
    }

    stage('CI') {
      parallel {
        stage('Backend') {
          steps {
            dir('backend') {
              sh '''
                set -e
                npm ci
                npm run lint
                npm test
                npm run build
              '''
            }
          }
          post {
            success {
              archiveArtifacts artifacts: 'backend/dist/lambda/*.zip', fingerprint: true, allowEmptyArchive: false
            }
          }
        }

        stage('Mobile') {
          steps {
            dir('mobile') {
              sh '''
                set -e
                npm ci
                npm run lint
              '''
            }
          }
        }

        stage('Terraform Validate') {
          steps {
            dir('infra/terraform') {
              sh '''
                set -e
                terraform init -backend=false -input=false
                terraform validate
                terraform fmt -check -recursive
              '''
            }
          }
        }
      }
    }

    stage('Generate Environment Config') {
      when {
        expression { params.RUN_DEPLOY }
      }
      steps {
        withCredentials([
          string(credentialsId: 'distribution-webhook-fcm-service-account-json', variable: 'TF_VAR_fcm_service_account_json')
        ]) {
          sh '''
            set -e
            export TF_VAR_region="${TF_VAR_region}"
            export TF_infra_env="${TF_infra_env}"
            export TF_VAR_project_name="${PROJECT_NAME}"
            export TF_workspace="${TF_workspace}"
            ./scripts/generate-env-config.sh
          '''
        }
      }
    }

    stage('Terraform Plan') {
      when {
        expression { params.RUN_DEPLOY }
      }
      steps {
        withAWS(credentials: 'distribution-webhook-aws', region: "${params.AWS_REGION}") {
          dir('infra/terraform') {
            sh '''
              set -e
              CONFIG_DIR="configs/${TF_VAR_region}/${TF_infra_env}"
              terraform init -input=false
              terraform workspace select "${TF_workspace}" || terraform workspace new "${TF_workspace}"
              terraform plan -input=false \
                -var-file="${CONFIG_DIR}/config.tfvars" \
                -var-file="${CONFIG_DIR}/secrets.auto.tfvars" \
                -out=tfplan
            '''
          }
        }
      }
      post {
        success {
          archiveArtifacts artifacts: 'infra/terraform/tfplan', fingerprint: true, allowEmptyArchive: false
        }
      }
    }

    stage('Deploy Infrastructure') {
      when {
        expression { params.RUN_DEPLOY }
      }
      steps {
        withAWS(credentials: 'distribution-webhook-aws', region: "${params.AWS_REGION}") {
          dir('infra/terraform') {
            sh '''
              set -e
              terraform init -input=false
              terraform workspace select "${TF_workspace}"
              terraform apply -input=false -auto-approve tfplan
              terraform output -json > ../../terraform-outputs.json
            '''
          }
        }
      }
      post {
        success {
          archiveArtifacts artifacts: 'terraform-outputs.json', fingerprint: true, allowEmptyArchive: false
        }
      }
    }

    stage('Deploy Lambda Code') {
      when {
        expression { params.RUN_DEPLOY }
      }
      steps {
        withAWS(credentials: 'distribution-webhook-aws', region: "${params.AWS_REGION}") {
          sh '''
            set -e
            PROJECT_NAME="${PROJECT_NAME}" \
            ENVIRONMENT="${DEPLOY_ENV}" \
            AWS_REGION="${AWS_DEFAULT_REGION}" \
            ./scripts/jenkins-deploy-lambdas.sh
          '''
        }
      }
    }

    stage('Build Mobile') {
      when {
        allOf {
          expression { params.RUN_DEPLOY }
          expression { params.BUILD_MOBILE }
        }
      }
      steps {
        dir('mobile') {
          withCredentials([
            string(credentialsId: 'distribution-webhook-eas-token', variable: 'EXPO_TOKEN')
          ]) {
            sh '''
              set -e
              npm install -g eas-cli
              eas whoami
              eas build --platform all --non-interactive --no-wait
            '''
          }
        }
      }
    }

    stage('Smoke Test') {
      when {
        allOf {
          expression { params.RUN_DEPLOY }
          expression { params.RUN_SMOKE_TEST }
        }
      }
      steps {
        script {
          def outputs = readJSON file: 'terraform-outputs.json'
          env.SMOKE_TEST_API_BASE_URL = outputs.api_base_url.value
          env.SMOKE_TEST_WEBHOOK_PASSWORD = outputs.webhook_basic_auth_password.value
        }
        sh '''
          set -e
          SMOKE_TEST_API_BASE_URL="${SMOKE_TEST_API_BASE_URL}" \
          SMOKE_TEST_WEBHOOK_USERNAME="webhook-user" \
          SMOKE_TEST_WEBHOOK_PASSWORD="${SMOKE_TEST_WEBHOOK_PASSWORD}" \
          ./scripts/jenkins-smoke-test.sh
        '''
      }
    }
  }

  post {
    always {
      junit allowEmptyResults: true, testResults: 'backend/test-results/**/*.xml, backend/junit.xml'
      cleanWs(
        deleteDirs: true,
        patterns: [[pattern: '**/node_modules/**', type: 'INCLUDE']]
      )
    }
    success {
      echo 'Pipeline completed successfully.'
    }
    failure {
      echo 'Pipeline failed. Review stage logs and archived artifacts.'
    }
  }
}
