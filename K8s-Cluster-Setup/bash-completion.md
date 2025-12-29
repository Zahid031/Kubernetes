sudo apt update && sudo apt install bash-completion

echo 'source <(kubectl completion bash)' >> ~/.bashrc
echo "alias k=kubectl" >> ~/.bashrc
echo 'complete -o default -F __start_kubectl k' >> ~/.bashrc

source ~/.bashrc


