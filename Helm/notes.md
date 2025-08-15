helm install release_name --value ymlfile repo/imaage


helm upgrade --namespace database my-mariadb oci://registry-1.docker.io/bitnamicharts/mariadb --set auth.rootPassword=$ROOT_PASSWORD

helm install -n database --values maria_db_custom.yml my-mariadb bitnami/mariadb --version 21.0.8

helm uninstall my-mariadb -n database --keep-history
Helm Deployment Workflow
Load charts and Dependencies->Parse values to Yamls ->Generate the yamls->Parse yml to kube object and validate->send validate yml to K8s

valiate yml before deploy(optional) though during Deployment it validate first but we can validate fisrt if we want

helm install -n database --values maria_db_custom.yml my-mariadb bitnami/mariadb --version 21.0.8 --dry-run

Generate deployments yml:
helm template -n database --values maria_db_custom.yml my-mariadb bitnami/mariadb --version 21.0.8

Deployed information:
helm list -A
helm get notes deployment_name

helm get values deployment_name  //for user supplied value


helm get values deployment_name --revision 1 //it will show the value of revision 1
helm get manifest deployment_name --revision 1
helm history deployment_name -n namespace
Rollback using helm:

helm rollback deployment_name 1 -n namespace
helm get secrets
if we uninstall and keep secrets then we can reinstall using rollback to a specific revision
