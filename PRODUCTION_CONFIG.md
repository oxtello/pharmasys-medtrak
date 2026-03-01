# PRODUCTION ENVIRONMENT CONFIGURATION

## Backend Production Configuration (.env)

```bash
# ============================================
# DATABASE CONFIGURATION
# ============================================
DATABASE_URL=postgres://meduser:STRONG_PASSWORD_HERE@postgres:5432/medication_inventory

# ============================================
# APPLICATION SETTINGS
# ============================================
NODE_ENV=production
PORT=5000

# ============================================
# SECURITY
# ============================================
# Generate using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=GENERATE_STRONG_RANDOM_STRING_HERE

# ============================================
# URLS
# ============================================
REACT_APP_URL=https://your-domain.com

# ============================================
# EMAIL NOTIFICATIONS (Optional)
# ============================================
# Leave blank if not using email notifications
EMAIL_SERVICE=gmail
EMAIL_USER=notifications@your-domain.com
EMAIL_PASSWORD=your-app-specific-password

# ============================================
# CORS SETTINGS
# ============================================
CORS_ORIGIN=https://your-domain.com
```

## Frontend Production Configuration (.env)

```bash
# ============================================
# API CONFIGURATION
# ============================================
REACT_APP_API_URL=https://your-domain.com/api
```

## Docker Compose Production Configuration (docker-compose.yml)

```yaml
version: '3.9'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: med_postgres
    environment:
      POSTGRES_USER: meduser
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: medication_inventory
    restart: unless-stopped
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U meduser"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - med-network

  # Express Backend API
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    container_name: med_backend
    environment:
      DATABASE_URL: ${DATABASE_URL}
      NODE_ENV: ${NODE_ENV}
      PORT: ${PORT}
      JWT_SECRET: ${JWT_SECRET}
      REACT_APP_URL: ${REACT_APP_URL}
      EMAIL_SERVICE: ${EMAIL_SERVICE}
      EMAIL_USER: ${EMAIL_USER}
      EMAIL_PASSWORD: ${EMAIL_PASSWORD}
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - med-network

  # React Frontend
  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    container_name: med_frontend
    environment:
      REACT_APP_API_URL: ${REACT_APP_API_URL}
    restart: unless-stopped
    depends_on:
      - backend
    networks:
      - med-network

volumes:
  postgres_data:
    driver: local

networks:
  med-network:
    driver: bridge
```

## Nginx Configuration (nginx.conf)

```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS main configuration
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
    limit_req_status 429;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        limit_req zone=general burst=20 nodelay;
    }

    # API Routes
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        limit_req zone=api burst=200 nodelay;
    }

    # Health endpoint (not rate limited)
    location /health {
        proxy_pass http://localhost:5001/health;
    }

    # Static assets (cache)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3000;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

## Systemd Service File (medication-inventory.service)

```ini
[Unit]
Description=Medication Inventory System
After=network.target
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=/opt/medication-inventory
ExecStart=/usr/bin/docker-compose up
ExecStop=/usr/bin/docker-compose down
Restart=always
RestartSec=10

# User
User=ubuntu

# Environment
EnvironmentFile=/opt/medication-inventory/.env

[Install]
WantedBy=multi-user.target
```

## Install Systemd Service

```bash
sudo cp medication-inventory.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable medication-inventory
sudo systemctl start medication-inventory
```

## Monitoring Configuration (prometheus-like)

```yaml
# monitoring.yml
services:
  - name: backend
    endpoint: http://localhost:5001/health
    timeout: 30
    retry: 3

  - name: frontend
    endpoint: http://localhost:3000
    timeout: 30
    retry: 3

  - name: database
    endpoint: postgres://localhost:5432
    timeout: 30
    retry: 3

alerts:
  - name: service_down
    condition: "status != 200"
    severity: critical

  - name: high_memory
    condition: "memory > 80%"
    severity: warning

  - name: database_full
    condition: "disk > 85%"
    severity: critical
```

## Backup Configuration

```bash
# backup.conf
BACKUP_RETENTION_DAYS=30
BACKUP_SCHEDULE="0 2 * * *"  # Daily at 2 AM
BACKUP_LOCATION="/backups/medication-inventory"
BACKUP_COMPRESS=true
BACKUP_ENCRYPT=false
BACKUP_REMOTE_UPLOAD=false
```

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment (1 week before)
- [ ] Infrastructure prepared and tested
- [ ] SSL certificates obtained
- [ ] Domain DNS configured
- [ ] Email service credentials ready
- [ ] Team trained on procedures
- [ ] Rollback plan documented
- [ ] Backup procedures tested

### Deployment Day (2 hours before)
- [ ] Maintenance window announced
- [ ] Final backup created
- [ ] Team gathered for deployment
- [ ] Runbook printed and distributed
- [ ] Communication channels open

### Deployment (execution)
- [ ] Build Docker images
- [ ] Pull latest code
- [ ] Start services
- [ ] Run migrations
- [ ] Seed data
- [ ] Verify health checks
- [ ] Test application workflows
- [ ] Announce completion

### Post-Deployment (first 48 hours)
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Gather user feedback
- [ ] Verify backups working
- [ ] Document any issues
- [ ] Celebrate success!

---

## QUICK REFERENCE

### Essential Commands

```bash
# View all services
docker compose ps

# View logs
docker compose logs -f med_backend

# Execute command in container
docker exec med_backend npm run migrate

# Restart service
docker compose restart med_backend

# Stop all services
docker compose down

# Start all services
docker compose up -d

# Backup database
docker exec med_postgres pg_dump -U meduser medication_inventory | gzip > backup.sql.gz

# Restore database
docker exec -i med_postgres psql -U meduser medication_inventory < backup.sql
```

---

## PRODUCTION READINESS SIGN-OFF

**System Name**: Medication Inventory System  
**Version**: 2.0.0  
**Deployment Date**: ________________  
**Deployed By**: ________________  
**Approved By**: ________________  

**Sign-off Checklist**:
- [ ] All tests passing
- [ ] Security review completed
- [ ] Performance acceptable
- [ ] Documentation complete
- [ ] Team trained
- [ ] Rollback plan ready
- [ ] Monitoring configured
- [ ] Backup verified

**Notes**: _____________________

---

**System is production-ready!**

For deployment support, contact: [support@your-domain.com](mailto:support@your-domain.com)
