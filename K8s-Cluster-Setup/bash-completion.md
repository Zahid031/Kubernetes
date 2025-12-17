sudo apt update && sudo apt install bash-completion

echo 'source <(kubectl completion bash)' >> ~/.bashrc

source ~/.bashrc
alias k=kubectl
complete -o default -F __start_kubectl k

