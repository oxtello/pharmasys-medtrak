# MEDICATION INVENTORY SYSTEM - DEPLOYMENT GUIDE

**Document Version**: 1.0  
**Last Updated**: 2026-02-28  
**Status**: Ready for Production Deployment

---

## TABLE OF CONTENTS
1. Pre-Deployment Checklist
2. Infrastructure Requirements
3. Deployment Steps
4. Configuration
5. Post-Deployment Verification
6. Monitoring & Maintenance
7. Backup & Recovery
8. Troubleshooting

---

## PART 1: PRE-DEPLOYMENT CHECKLIST

### Infrastructure Requirements
- [ ] Server with Docker and Docker Compose installed
- [ ] Minimum 2GB RAM
- [ ] Minimum 20GB disk space
- [ ] Port 80/443 (HTTPS) available
- [ ] Port 5432 available (database)
- [ ] Internet connectivity for Docker pulls
- [ ] SSL/TLS certificates (for HTTPS)
- [ ] Domain name configured

### Team Preparation
- [ ] Designate deployment lead
- [ ] Schedule deployment window
- [ ] Notify end users of maintenance
- [ ] Backup existing systems (if any)
- [ ] Test deployment in staging (if available)
- [ ] Prepare rollback procedure
- [ ] Have technical support on standby

### Security Review
- [ ] Change JWT_SECRET to strong random value
- [ ] Review database password
- [ ] Configure firewall rules
- [ ] Setup SSL certificates
- [ ] Review CORS settings
- [ ] Verify email credentials (if using)
- [ ] Check API rate limits
- [ ] Review authentication methods

### Documentation Ready
- [ ] Admin user credentials prepared
- [ ] User manual for staff
- [ ] Quick reference guides
- [ ] Support contact list
- [ ] Escalation procedures

---

## PART 2: INFRASTRUCTURE SETUP

### Option A: Deploy on AWS EC2

**Instance Requirements:**
```
- Instance Type: t3.medium or larger
- OS: Ubuntu 20.04 LTS or later
- Storage: 30GB EBS volume
- Security Group: Allow 80, 443, 22
```

**Steps:**
```bash
# SSH into instance
ssh -i your-key.pem ubuntu@your-instance-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### Option B: Deploy on DigitalOcean App Platform

**Steps:**
1. Create new App
2. Connect GitHub repository
3. Select Docker deployment
4. Set environment variables
5. Configure domain
6. Deploy

### Option C: Deploy on Azure Container Instances

**Steps:**
1. Create resource group
2. Deploy Docker Compose via ACI
3. Configure networking
4. Set environment variables
5. Configure domain

### Option D: Deploy on GCP Cloud Run

**Steps:**
1. Create Cloud Run service
2. Upload Docker image
3. Set environment variables
4. Configure domain
5. Deploy

---

## PART 3: DEPLOYMENT STEPS

### Step 1: Prepare the Application

```bash
# Clone repository
git clone <your-repo> medication-inventory-system
cd medication-inventory-system

# Create production environment file
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Step 2: Configure Environment Variables

**Edit backend/.env:**
```bash
# Database
DATABASE_URL=postgres://meduser:STRONG_PASSWORD@postgres:5432/medication_inventory

# Security
NODE_ENV=production
JWT_SECRET=GENERATE_STRONG_RANDOM_STRING_HERE
PORT=5000

# Frontend URL
REACT_APP_URL=https://your-domain.com

# Email (optional)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

**Edit frontend/.env:**
```bash
REACT_APP_API_URL=https://your-domain.com/api
```

### Step 3: Generate Strong Secrets

```bash
# Generate JWT Secret (run locally)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate Database Password
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

**Copy outputs to .env files**

### Step 4: Update docker-compose.yml for Production

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: med_postgres
    environment:
      POSTGRES_USER: meduser
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: medication_inventory
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U meduser"]
      interval: 10s
      timeout: 5s
      retries: 5

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
    ports:
      - "5000:5000"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    container_name: med_frontend
    environment:
      REACT_APP_API_URL: ${REACT_APP_API_URL}
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
    driver: local
```

### Step 5: Build and Start Services

```bash
# Build containers
docker compose build

# Start services in background
docker compose up -d

# Wait for database to be ready
sleep 10

# Run database migrations
docker exec med_backend npm run migrate

# Seed medications
docker exec med_backend npm run seed

# Verify services are running
docker compose ps
```

### Step 6: Setup SSL/TLS with Nginx

**Install Nginx:**
```bash
sudo apt install nginx certbot python3-certbot-nginx
```

**Create Nginx config:**
```bash
sudo nano /etc/nginx/sites-available/medication-inventory
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/medication-inventory /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**Setup SSL certificate:**
```bash
sudo certbot --nginx -d your-domain.com
```

---

## PART 4: POST-DEPLOYMENT VERIFICATION

### Verify Services Running

```bash
# Check all containers
docker compose ps

# Check logs
docker compose logs --tail=50 med_backend
docker compose logs --tail=50 med_frontend
docker compose logs --tail=50 med_postgres

# Test health endpoints
curl https://your-domain.com/health
curl https://your-domain.com/api/auth/login
```

### Test Application

```bash
# Frontend loads
curl -I https://your-domain.com

# Backend API responds
curl https://your-domain.com/api/health | jq .

# Database connected
docker exec med_postgres pg_isready -U meduser
```

### Verify Data

```bash
# Check database contents
docker exec med_postgres psql -U meduser -d medication_inventory -c "SELECT COUNT(*) FROM users;"
docker exec med_postgres psql -U meduser -d medication_inventory -c "SELECT COUNT(*) FROM medications;"

# Expected: 5 users, 15 medications
```

---

## PART 5: SETUP MONITORING

### System Monitoring

**Install monitoring tools:**
```bash
# Install htop for resource monitoring
sudo apt install htop

# Check resources
htop

# Monitor Docker
docker stats
```

**Setup log monitoring:**
```bash
# View all logs
docker compose logs -f

# View specific service
docker compose logs -f med_backend

# Export logs
docker compose logs > deployment.log
```

### Application Monitoring

**Setup health checks:**
```bash
# Create monitoring script
cat > /usr/local/bin/check-med-inventory.sh << 'EOF'
#!/bin/bash
FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" https://your-domain.com)
BACKEND=$(curl -s -o /dev/null -w "%{http_code}" https://your-domain.com/api/health)

if [ "$FRONTEND" = "200" ] && [ "$BACKEND" = "200" ]; then
    echo "✓ Services healthy"
    exit 0
else
    echo "✗ Service issue - Frontend: $FRONTEND, Backend: $BACKEND"
    exit 1
fi
EOF

chmod +x /usr/local/bin/check-med-inventory.sh

# Run daily
(crontab -l 2>/dev/null; echo "0 0 * * * /usr/local/bin/check-med-inventory.sh >> /var/log/med-inventory-check.log") | crontab -
```

### Database Monitoring

```bash
# Check database size
docker exec med_postgres psql -U meduser -d medication_inventory -c "
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# Monitor connections
docker exec med_postgres psql -U meduser -d medication_inventory -c "
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"
```

---

## PART 6: BACKUP & RECOVERY

### Automated Daily Backups

**Create backup script:**
```bash
cat > /usr/local/bin/backup-med-inventory.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/medication-inventory"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker exec med_postgres pg_dump -U meduser medication_inventory | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup Docker volumes
docker run --rm -v med_postgres_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/volumes_$DATE.tar.gz /data

# Keep only last 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR"
EOF

chmod +x /usr/local/bin/backup-med-inventory.sh

# Schedule daily at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-med-inventory.sh >> /var/log/med-inventory-backup.log") | crontab -
```

### Manual Backup

```bash
# Backup database
docker exec med_postgres pg_dump -U meduser medication_inventory > backup_$(date +%Y%m%d).sql

# Backup volumes
docker run --rm -v med_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/volumes_$(date +%Y%m%d).tar.gz /data
```

### Restore from Backup

```bash
# Stop services
docker compose down

# Restore database
docker compose up -d postgres
sleep 5
docker exec -i med_postgres psql -U meduser medication_inventory < backup_20260228.sql

# Restore volumes
cd /var/lib/docker/volumes/med_postgres_data/_data
tar xzf volumes_20260228.tar.gz

# Restart services
docker compose up -d
```

---

## PART 7: TROUBLESHOOTING

### Common Issues

**Issue: Services won't start**
```bash
# Check logs
docker compose logs

# Rebuild containers
docker compose down
docker compose build --no-cache
docker compose up -d

# Check resources
docker stats
```

**Issue: Database connection error**
```bash
# Check database is running
docker compose ps med_postgres

# Verify connection string
echo $DATABASE_URL

# Test connection
docker exec med_postgres psql -U meduser -c "SELECT 1"
```

**Issue: Frontend shows blank page**
```bash
# Check frontend logs
docker compose logs med_frontend

# Clear browser cache
# Check browser console for errors
# Verify API_URL is correct
docker exec med_frontend env | grep REACT_APP
```

**Issue: High memory usage**
```bash
# Check memory usage
docker stats

# Reduce container limits
# Update docker-compose.yml with resource limits
# Restart containers
```

**Issue: SSL certificate error**
```bash
# Check certificate
sudo certbot certificates

# Renew certificate
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run
```

---

## PART 8: SECURITY HARDENING

### Network Security

```bash
# Setup firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Restrict database access to localhost only
# Update docker-compose.yml
# Remove port exposure for postgres
```

### Application Security

```bash
# Update dependencies monthly
docker exec med_backend npm outdated
docker exec med_backend npm update

# Check for vulnerabilities
docker exec med_backend npm audit
docker exec med_backend npm audit fix
```

### Database Security

```bash
# Change default credentials
# Update POSTGRES_PASSWORD in .env

# Enable connection encryption
# Update PostgreSQL config

# Setup database user permissions
docker exec med_postgres psql -U meduser -d medication_inventory -c "
CREATE USER app_user WITH PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE medication_inventory TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
"
```

---

## PART 9: MAINTENANCE SCHEDULE

### Daily
- [ ] Check application health
- [ ] Review error logs
- [ ] Monitor resource usage

### Weekly
- [ ] Review audit logs
- [ ] Check backup status
- [ ] Update monitoring

### Monthly
- [ ] Update dependencies
- [ ] Security audit
- [ ] Performance review
- [ ] Database maintenance

### Quarterly
- [ ] Disaster recovery drill
- [ ] Security patches
- [ ] Capacity planning
- [ ] User feedback review

---

## DEPLOYMENT SCRIPTS

### All-in-One Deployment Script

```bash
#!/bin/bash
set -e

echo "Starting deployment..."

# Build
echo "Building containers..."
docker compose build

# Stop existing
echo "Stopping existing services..."
docker compose down || true

# Start services
echo "Starting services..."
docker compose up -d

# Wait for services
echo "Waiting for services to be ready..."
sleep 10

# Migrate database
echo "Running database migrations..."
docker exec med_backend npm run migrate

# Seed data
echo "Seeding medications..."
docker exec med_backend npm run seed

# Verify
echo "Verifying deployment..."
if curl -f http://localhost:5001/health > /dev/null; then
    echo "✓ Backend healthy"
else
    echo "✗ Backend health check failed"
    exit 1
fi

echo "✓ Deployment completed successfully!"
```

---

## SUPPORT & ESCALATION

### Contact Information
- **Technical Support**: [your-support@email.com](mailto:your-support@email.com)
- **Emergency Line**: [your-phone-number]
- **On-Call Engineer**: [name/contact]

### Escalation Process
1. **Severity 1** (Down/Critical): Immediate response
2. **Severity 2** (Degraded): 1-hour response
3. **Severity 3** (Minor): 4-hour response
4. **Severity 4** (Enhancement): 24-hour response

---

## SIGN-OFF

**Deployment Lead**: _________________  
**Date**: _________________  
**Approved By**: _________________  
**Notes**: _________________________

---

**System is ready for production deployment.**

For questions or assistance, contact the DevOps team.
