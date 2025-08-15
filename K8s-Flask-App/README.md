# Flask REST API Kubernetes Deployment

A comprehensive guide to create, containerize, and deploy a simple Flask REST API to Kubernetes using Docker and Makefile automation.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Application Components](#application-components)
- [Deployment Process](#deployment-process)
- [Troubleshooting](#troubleshooting)
- [Cleanup](#cleanup)
- [Contributing](#contributing)

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

- [Python 3.9+](https://www.python.org/downloads/)
- [Docker](https://docs.docker.com/get-docker/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Kubernetes cluster](https://kubernetes.io/docs/setup/) (local or cloud)
- [Docker Hub account](https://hub.docker.com/)
- [Make](https://www.gnu.org/software/make/) (usually pre-installed on Linux/macOS)

## 📁 Project Structure

```
flask-k8s-app/
├── app.py                 # Flask REST API application
├── Dockerfile            # Docker container configuration
├── deployment.yaml       # Kubernetes deployment and service config
├── Makefile             # Automation scripts
└── README.md            # This file
```

## 🚀 Quick Start

1. **Clone or create the project directory:**
   ```bash
   mkdir flask-k8s-app
   cd flask-k8s-app
   ```

2. **Update the Docker Hub username in the Makefile:**
   ```bash
   # Replace 'your-docker-hub-username' with your actual Docker Hub username
   sed -i 's/your-docker-hub-username/YOUR_ACTUAL_USERNAME/g' Makefile
   sed -i 's/your-docker-hub-username/YOUR_ACTUAL_USERNAME/g' deployment.yaml
   ```

3. **Login to Docker Hub:**
   ```bash
   docker login
   ```

4. **Build, push, and deploy:**
   ```bash
   make all
   ```

5. **Access your application:**
   ```bash
   # Get the external IP (for LoadBalancer service)
   kubectl get services flask-app-service
   
   # Test the endpoints
   curl http://<EXTERNAL-IP>/
   curl http://<EXTERNAL-IP>/hello/world
   ```

## 🏗️ Application Components

### Flask REST API (`app.py`)

A simple REST API with two endpoints:
- `GET /` - Returns a "Hello, World!" message
- `GET /hello/<name>` - Returns a personalized greeting

### Docker Configuration (`Dockerfile`)

- Based on Python 3.9 slim image
- Exposes port 5000
- Installs Flask dependencies
- Runs the application on container start

### Kubernetes Configuration (`deployment.yaml`)

- **Deployment**: Manages 2 replica pods running the Flask app
- **Service**: LoadBalancer service exposing the app on port 80

### Automation (`Makefile`)

Available commands:
- `make build` - Build Docker image
- `make push` - Push image to Docker Hub
- `make deploy` - Deploy to Kubernetes
- `make all` - Execute build, push, and deploy
- `make clean` - Remove deployment from Kubernetes

## 🔄 Deployment Process

### Step-by-Step Deployment

1. **Build the Docker image:**
   ```bash
   make build
   ```

2. **Push to Docker Hub:**
   ```bash
   make push
   ```

3. **Deploy to Kubernetes:**
   ```bash
   make deploy
   ```

4. **Verify deployment:**
   ```bash
   kubectl get pods
   kubectl get services
   ```

### Monitoring Your Deployment

```bash
# Check pod status
kubectl get pods -l app=flask-app

# View pod logs
kubectl logs -l app=flask-app

# Describe service
kubectl describe service flask-app-service

# Port forward for local testing (alternative to LoadBalancer)
kubectl port-forward service/flask-app-service 8080:80
```

## 🛠️ Troubleshooting

### Common Issues and Solutions

#### Docker Push Error: "requested access to the resource is denied"

**Cause:** Authentication or repository naming issues.

**Solution:**
1. Ensure you're logged into Docker Hub:
   ```bash
   docker login
   ```

2. Verify your Docker Hub username in the Makefile and deployment.yaml

3. Create the repository on Docker Hub if it doesn't exist

4. For 2FA-enabled accounts, use a personal access token instead of password

#### Kubernetes Deployment Issues

**Pod not starting:**
```bash
# Check pod events
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name>
```

**Service not accessible:**
```bash
# Check if LoadBalancer got external IP
kubectl get service flask-app-service

# For local clusters (minikube), use NodePort or port-forward
kubectl patch service flask-app-service -p '{"spec": {"type": "NodePort"}}'
```

#### Make Command Not Found

**On Ubuntu/Debian:**
```bash
sudo apt-get install build-essential
```

**On macOS:**
```bash
xcode-select --install
```

### Environment-Specific Notes

- **Minikube:** Use `minikube tunnel` for LoadBalancer services
- **Docker Desktop:** Kubernetes is available in settings
- **Cloud providers:** LoadBalancer will provision cloud load balancer

## 🧹 Cleanup

To remove all deployed resources:

```bash
make clean
```

Or manually:
```bash
kubectl delete -f deployment.yaml
```

To remove Docker images:
```bash
docker rmi your-docker-hub-username/flask-app:latest
```

## 📝 Configuration Options

### Scaling the Application

Modify replicas in `deployment.yaml`:
```yaml
spec:
  replicas: 5  # Increase number of pods
```

Apply changes:
```bash
kubectl apply -f deployment.yaml
```

### Changing Ports

1. Update the Flask app port in `app.py`
2. Update the Docker EXPOSE port in `Dockerfile`
3. Update containerPort and targetPort in `deployment.yaml`

### Environment Variables

Add environment variables to the deployment:
```yaml
containers:
- name: flask-app
  image: your-docker-hub-username/flask-app:latest
  ports:
  - containerPort: 5000
  env:
  - name: FLASK_ENV
    value: "production"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any problems or have questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Review Kubernetes and Docker documentation
3. Open an issue in this repository

## 🔗 Useful Links

- [Flask Documentation](https://flask.palletsprojects.com/)
- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)

---

**Happy Coding! 🚀**