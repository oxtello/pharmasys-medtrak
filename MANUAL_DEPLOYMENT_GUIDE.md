# PharmaSys MedTrak - MANUAL DEPLOYMENT (Copy & Paste)

**Status**: Ready to Deploy  
**Time**: ~20 minutes  
**Server**: 24.199.110.247  
**Domain**: pharmasysmedtrak.com  

---

## 🔴 IMPORTANT: You Need to SSH Into Your Droplet

From your computer, open Terminal/Command Prompt and run:

```bash
ssh root@24.199.110.247
```

Enter your droplet root password when prompted.

---

## DEPLOYMENT COMMANDS (Copy & Paste Each Section)

### SECTION 1: Update System & Install Docker (3 min)

Copy and paste this entire block:

```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
curl -L "https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
docker --version
docker-compose --version
```

**Expected output**: Should show Docker and Docker Compose versions.

---

### SECTION 2: Clone Project & Verify Files (2 min)

```bash
git clone YOUR_REPOSITORY_URL /opt/pharmasys-medtrak
cd /opt/pharmasys-medtrak
ls -la
```

**Expected output**: Should list backend/, frontend/, docker-compose.yml, etc.

---

### SECTION 3: Verify Configuration Files (1 min)

```bash
cat backend/.env
cat frontend/.env
```

**Expected output**: Should show DATABASE_URL, JWT_SECRET, REACT_APP_API_URL

---

### SECTION 4: Build & Start Containers (5 min)

```bash
docker-compose build
docker-compose up -d
sleep 30
docker-compose ps
```

**Expected output**: Three containers running:
- pharmasys_postgres
- pharmasys_backend
- pharmasys_frontend

---

### SECTION 5: Initialize Database (2 min)

```bash
docker-compose exec backend npm run migrate
docker-compose exec backend npm run seed
docker-compose ps
```

**Expected output**: Migrations complete, medications seeded.

---

### SECTION 6: Install Nginx & SSL (3 min)

```bash
apt install nginx certbot python3-certbot-nginx -y
systemctl stop nginx
certbot certonly --standalone -d pharmasysmedtrak.com
```

When prompted:
- Enter your email: `admin@pharmasysmedtrak.com`
- Type `a` to agree to terms
- Wait for "Successfully received certificate"

---

### SECTION 7: Configure Nginx (2 min)

```bash
nano /etc/nginx/sites-available/pharmasys-medtrak
```

**Paste this entire configuration:**

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

---

### SECTION 8: Enable & Start Nginx (1 min)

```bash
ln -s /etc/nginx/sites-available/pharmasys-medtrak /etc/nginx/sites-enabled/
nginx -t
systemctl start nginx
systemctl enable nginx
systemctl enable certbot.timer
```

**Expected output**: All commands should succeed without errors.

---

### SECTION 9: Setup Backups (2 min)

```bash
nano /usr/local/bin/backup-pharmasys-medtrak.sh
```

**Paste this script:**

```bash
#!/bin/bash
BACKUP_DIR="/backups/pharmasys-medtrak"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cd /opt/pharmasys-medtrak
docker-compose exec -T postgres pg_dump -U meduser pharmasys_medtrak | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup created: $BACKUP_DIR/backup_$DATE.sql.gz"
```

**Save**: Press `Ctrl+X`, then `Y`, then `Enter`

```bash
chmod +x /usr/local/bin/backup-pharmasys-medtrak.sh
/usr/local/bin/backup-pharmasys-medtrak.sh
```

**Expected output**: "Backup created: /backups/pharmasys-medtrak/backup_YYYYMMDD_HHMMSS.sql.gz"

---

### SECTION 10: Schedule Daily Backups (1 min)

```bash
crontab -e
```

Add this line at the bottom:
```
0 2 * * * /usr/local/bin/backup-pharmasys-medtrak.sh >> /var/log/pharmasys-backup.log 2>&1
```

**Save**: Press `Ctrl+X`, then `Y`, then `Enter`

---

### SECTION 11: Verify Deployment (2 min)

```bash
docker-compose ps
docker-compose logs backend | tail -20
curl http://localhost:5000/health
```

**Expected output**: 
- All containers running
- No error messages
- JSON response from health endpoint

---

## 🌐 FINAL STEP: Point Your Domain

**On your domain registrar** (GoDaddy, Namecheap, etc.):

1. Log in to your account
2. Go to **DNS Management** or **DNS Settings**
3. Find the **A Record** for `pharmasysmedtrak.com`
4. Change the value to: `24.199.110.247`
5. Save/Update
6. **Wait 5-10 minutes** for DNS to propagate

---

## ✅ VERIFY IT WORKS

After DNS propagates (5-10 min), open your browser:

```
https://pharmasysmedtrak.com
```

**You should see the PharmaSys MedTrak login page!**

Login with:
- **Email**: admin@medinventory.com
- **Password**: AdminSecure123!

---

## 🎉 YOU'RE LIVE!

Once logged in:
1. Change your admin password immediately
2. Add clinic users
3. Test adding a medication
4. Test barcode scanning
5. Verify reports work

---

## 🆘 TROUBLESHOOTING

**Can't connect to domain?**
```bash
# Check DNS has propagated
nslookup pharmasysmedtrak.com
# Should show: 24.199.110.247
```

**Services not running?**
```bash
# Check status
docker-compose ps

# If not running, restart
docker-compose restart
```

**Need to see logs?**
```bash
# View backend logs
docker-compose logs -f backend

# View all logs
docker-compose logs -f

# Exit: Press Ctrl+C
```

**Something else broken?**
```bash
# Check all containers
docker-compose ps

# Restart everything
docker-compose restart

# Wait 30 seconds
sleep 30

# Check again
docker-compose ps
```

---

## 📱 IMPORTANT INFO TO SAVE

```
Server IP:              24.199.110.247
Domain:                 pharmasysmedtrak.com
Database:               pharmasys_medtrak
Database User:          meduser
Database Password:      10969179@Ocean
JWT Secret:             8ba7b2aa8a6a29444384975ee3c9b4c6a0f259d1e222ddef86eb41b4d36abbbe
Admin Email:            admin@medinventory.com
Admin Password:         AdminSecure123! (CHANGE THIS!)
Backup Location:        /backups/pharmasys-medtrak/
Backup Time:            2 AM PST Daily
```

---

## ✨ YOU DID IT!

Your PharmaSys MedTrak system is now LIVE and production-ready!

**Total time: ~20 minutes**

Now train your team and monitor the system! 🚀
