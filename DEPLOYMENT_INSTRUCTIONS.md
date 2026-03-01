# PharmaSys MedTrak - Production Deployment Instructions

**Status**: ✅ READY FOR DEPLOYMENT  
**Generated**: 2026-02-28  
**Deployment Target**: DigitalOcean  
**Server IP**: 24.199.110.247  
**Domain**: pharmasysmedtrak.com  

---

## DEPLOYMENT CREDENTIALS & INFO

### Your Server Details
```
IP Address:         24.199.110.247
Hostname:           pharmasys-medtrak-prod
Domain:             pharmasysmedtrak.com
Database:           pharmasys_medtrak
Database User:      meduser
Database Password:  10969179@Ocean
JWT Secret:         (see SECRETS file)
Timezone:           Pacific Standard (PST/PDT)
```

### Test Credentials (After Deployment)
```
Admin Email:        admin@medinventory.com
Admin Password:     AdminSecure123!
⚠️  CHANGE THESE on first login!
```

---

## DEPLOYMENT STEPS (15-20 minutes)

### STEP 1: SSH into Your Droplet

```bash
ssh root@24.199.110.247
# Enter your root password when prompted
```

After connecting, you should see:
```
Welcome to Ubuntu 24.04 LTS
```

### STEP 2: Update System & Install Docker

```bash
# Update system packages
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### STEP 3: Clone Project & Upload Configuration

```bash
# Clone the repository
git clone YOUR_REPO_URL /opt/pharmasys-medtrak
cd /opt/pharmasys-medtrak

# Verify files exist
ls -la
# Should show: backend/, frontend/, docker-compose.yml, etc.
```

### STEP 4: Verify Configuration Files

The following .env files should already exist (they were created for you):

```bash
# Check backend config
cat backend/.env
# Should show DATABASE_URL, JWT_SECRET, etc.

# Check frontend config
cat frontend/.env
# Should show REACT_APP_API_URL
```

### STEP 5: Build & Start Containers

```bash
# Build Docker containers
docker-compose build

# Start all services
docker-compose up -d

# Wait 30 seconds for database to initialize
sleep 30

# Verify all containers are running
docker-compose ps
```

Expected output (all should show "Up"):
```
NAME                    STATUS
pharmasys_postgres      Up (healthy)
pharmasys_backend       Up
pharmasys_frontend      Up
```

### STEP 6: Initialize Database

```bash
# Run database migrations
docker-compose exec backend npm run migrate

# Seed default medications
docker-compose exec backend npm run seed

# Verify database tables created
docker-compose exec postgres psql -U meduser pharmasys_medtrak -c "\dt"
```

### STEP 7: Install Nginx & SSL

```bash
# Install Nginx and Certbot
apt install nginx certbot python3-certbot-nginx -y

# Stop Nginx temporarily
systemctl stop nginx

# Get free SSL certificate
certbot certonly --standalone -d pharmasysmedtrak.com
# Enter your email when prompted
# Type 'a' to agree to terms
```

### STEP 8: Configure Nginx

```bash
# Create Nginx configuration
nano /etc/nginx/sites-available/pharmasys-medtrak
```

**Paste this configuration:**

```nginx
server {
    listen 80;
    server_name pharmasysmedtrak.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name pharmasysmedtrak.com;

    ssl_certificate /etc/letsencrypt/live/pharmasysmedtrak.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pharmasysmedtrak.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

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
    }

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

**Save**: Press `Ctrl+X`, then `Y`, then `Enter`

### STEP 9: Enable Nginx & Start

```bash
# Enable the site
ln -s /etc/nginx/sites-available/pharmasys-medtrak /etc/nginx/sites-enabled/

# Test Nginx configuration
nginx -t
# Should show: "test is successful"

# Start Nginx
systemctl start nginx
systemctl enable nginx

# Enable SSL auto-renewal
systemctl enable certbot.timer
```

### STEP 10: Point Domain to Server

**On your domain registrar** (GoDaddy, Namecheap, etc.):

1. Go to **DNS Settings**
2. Find **A Record**
3. Change value to: `24.199.110.247`
4. Save
5. Wait 5-10 minutes for DNS propagation

### STEP 11: Verify Deployment

```bash
# Check services
docker-compose ps

# Check backend health
docker-compose logs --tail=20 backend

# Test backend API (wait 2 min for DNS)
curl https://pharmasysmedtrak.com/api/health
```

### STEP 12: Setup Automatic Backups

```bash
# Create backup script
nano /usr/local/bin/backup-pharmasys-medtrak.sh
```

**Paste this:**

```bash
#!/bin/bash
BACKUP_DIR="/backups/pharmasys-medtrak"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
docker-compose -f /opt/pharmasys-medtrak/docker-compose.yml exec -T postgres pg_dump -U meduser pharmasys_medtrak | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup created: $BACKUP_DIR/backup_$DATE.sql.gz"
```

**Save**: Press `Ctrl+X`, then `Y`, then `Enter`

```bash
# Make executable
chmod +x /usr/local/bin/backup-pharmasys-medtrak.sh

# Test it
/usr/local/bin/backup-pharmasys-medtrak.sh

# Schedule daily backup at 2 AM (PST)
crontab -e
# Add this line at bottom:
# 0 2 * * * /usr/local/bin/backup-pharmasys-medtrak.sh >> /var/log/pharmasys-backup.log 2>&1
# Save and exit
```

---

## VERIFICATION CHECKLIST

After all steps, verify everything is working:

```bash
# ✓ Check containers running
docker-compose ps

# ✓ Check backend logs
docker-compose logs backend | head -20

# ✓ Check database
docker-compose exec postgres psql -U meduser pharmasys_medtrak -c "SELECT COUNT(*) FROM users;"
# Should show: 5

# ✓ Check disk space
df -h
# Should show plenty of free space on /

# ✓ Check certificates
sudo certbot certificates
# Should list pharmasysmedtrak.com
```

---

## ACCESS YOUR SYSTEM

Once everything is working:

### From Browser
```
https://pharmasysmedtrak.com
```

### Login
```
Email:    admin@medinventory.com
Password: AdminSecure123!
```

### API Endpoint
```
https://pharmasysmedtrak.com/api
```

---

## POST-DEPLOYMENT TASKS

### Immediate (First Day)
- [ ] Login and verify system works
- [ ] Change admin password
- [ ] Create clinic-specific user accounts
- [ ] Add medication thresholds
- [ ] Test barcode scanning

### First Week
- [ ] Train staff on system
- [ ] Verify daily backups running
- [ ] Monitor system logs
- [ ] Set email notifications (optional)
- [ ] Configure medication alerts

### Ongoing
- [ ] Monitor backups daily
- [ ] Check logs weekly
- [ ] Update dependencies monthly
- [ ] Review audit trail
- [ ] Maintain security

---

## ESSENTIAL COMMANDS

**View all services:**
```bash
docker-compose ps
```

**View backend logs (last 50 lines):**
```bash
docker-compose logs --tail=50 backend
```

**View all logs in real-time:**
```bash
docker-compose logs -f
```

**Restart all services:**
```bash
docker-compose restart
```

**Restart just backend:**
```bash
docker-compose restart backend
```

**Create manual backup:**
```bash
docker-compose exec postgres pg_dump -U meduser pharmasys_medtrak | gzip > backup_$(date +%Y%m%d).sql.gz
```

**Restore backup:**
```bash
docker-compose exec -i postgres psql -U meduser pharmasys_medtrak < backup_file.sql
```

---

## TROUBLESHOOTING

**Issue: Cannot connect to domain**
- DNS not propagated yet (wait 5-10 min)
- Run: `nslookup pharmasysmedtrak.com`
- Should show: 24.199.110.247

**Issue: Services not starting**
```bash
docker-compose logs
# Check for errors
docker-compose down
docker-compose up -d
```

**Issue: Database connection error**
```bash
docker-compose ps postgres
docker-compose logs postgres
```

**Issue: SSL certificate error**
```bash
sudo certbot renew --dry-run
sudo certbot renew
```

**Issue: Out of memory**
```bash
docker stats
df -h
docker system prune -a
```

---

## SUPPORT & HELP

### If something breaks:
1. Check logs: `docker-compose logs`
2. Restart: `docker-compose restart`
3. Check disk: `df -h`
4. Check memory: `free -h`
5. Consult TROUBLESHOOTING_DIGITALOCEAN.md

### Contact:
- DigitalOcean Support: https://cloud.digitalocean.com/support
- Docker Docs: https://docs.docker.com/
- Check deployment guides in repository

---

## DEPLOYMENT SUMMARY

| Item | Value |
|------|-------|
| **Server IP** | 24.199.110.247 |
| **Domain** | pharmasysmedtrak.com |
| **Database** | pharmasys_medtrak |
| **Containers** | 3 (postgres, backend, frontend) |
| **Backup Frequency** | Daily at 2 AM PST |
| **SSL** | Let's Encrypt (auto-renew) |
| **Monitoring** | Manual (logs, backups) |
| **Monthly Cost** | ~$12 |

---

## YOU'RE READY TO DEPLOY! 🚀

Start at STEP 1 above and follow each step carefully.

**Estimated total time: 15-20 minutes**

If you get stuck on any step, refer to TROUBLESHOOTING_DIGITALOCEAN.md or DIGITALOCEAN_DEPLOYMENT_GUIDE.md.

**Good luck! PharmaSys MedTrak is about to go LIVE!**
