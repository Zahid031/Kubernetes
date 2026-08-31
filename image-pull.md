# back up the old one
sudo cp /etc/containerd/config.toml /etc/containerd/config.toml.bak

# copy the new file into place (e.g. after downloading/transferring it)
sudo vi /etc/containerd/config.toml

# create the hosts.toml for your insecure registry
sudo mkdir -p /etc/containerd/certs.d/192.168.169.66
sudo tee /etc/containerd/certs.d/192.168.169.66/hosts.toml <<'EOF'
server = "http://192.168.169.66"

[host."http://192.168.169.66"]
  capabilities = ["pull", "resolve", "push"]
  skip_verify = true
EOF

# restart and check
sudo systemctl restart containerd
sudo systemctl status containerd.service
