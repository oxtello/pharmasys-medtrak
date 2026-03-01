# PharmaSys MedTrak - DigitalOcean Deployment QUICK CHECKLIST

## BEFORE YOU START
- [ ] Domain name ready and available
- [ ] DigitalOcean account created
- [ ] Repository access (GitHub/GitLab)
- [ ] Strong passwords generated
- [ ] Printed DIGITALOCEAN_DEPLOYMENT_GUIDE.md
- [ ] Team notified of deployment time

---

## MINUTE 1-2: Create Droplet
- [ ] Sign into DigitalOcean
- [ ] Create Droplet: Ubuntu 24.04, $7.50/month, SSH key or password
- [ ] Copy IP address to a safe place
- [ ] Open terminal

---

## MINUTE 3-4: Connect & Update
```bash
ssh root@YOUR_IP
apt update && apt upgrade -y
```

---

## MINUTE 5-8: Install Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

curl -L "https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

docker --version
docker-compose --version
```

---

## MINUTE 9-10: Clone & Configure
```bash
git clone YOUR_REPO /opt/pharmasys-medtrak
cd /opt/pharmasys-medtrak

# Generate secrets
openssl rand -hex 32  # JWT secret
openssl rand -hex 16  # DB password

nano backend/.env
# Paste config with your domain, secrets, and DB password
# Save: Ctrl+X → Y → Enter

nano frontend/.env
# Paste config with your domain
# Save: Ctrl+X → Y → Enter
```

---

## MINUTE 11-13: Deploy
```bash
docker-compose build
docker-compose up -d
sleep 30
docker-compose exec backend npm run migrate
docker-compose exec backend npm run seed

# Verify
docker-compose ps
# Should see 3 containers: med_postgres, med_backend, med_frontend (all "Up")
```

---

## MINUTE 14-16: Setup HTTPS & Domain
```bash
# Point your domain to: YOUR_IP
# Wait 2-5 minutes for DNS to propagate

apt install nginx certbot python3-certbot-nginx -y
systemctl stop nginx

certbot certonly --standalone -d your-domain.com
# Enter email, agree to terms (A)

nano /etc/nginx/sites-available/pharmasys-medtrak
# Paste nginx config from guide
# Replace "your-domain.com" with actual domain
# Save: Ctrl+X → Y → Enter

ln -s /etc/nginx/sites-available/pharmasys-medtrak /etc/nginx/sites-enabled/
nginx -t
systemctl start nginx
systemctl enable nginx
```

---

## MINUTE 17-18: Verify & Test
```bash
# Check services
docker-compose ps

# Test frontend
curl https://your-domain.com

# Test backend
curl https://your-domain.com/api/health
```

---

## MINUTE 19-20: Backup Setup
```bash
nano /usr/local/bin/backup-medication-inventory.sh
# Paste backup script from guide
# Save: Ctrl+X → Y → Enter

chmod +x /usr/local/bin/backup-medication-inventory.sh
/usr/local/bin/backup-medication-inventory.sh

# Schedule
crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-medication-inventory.sh >> /var/log/med-backup.log 2>&1
# Save
```

---

## FINAL: Test & Launch
1. Open browser: `https://your-domain.com`
2. Login: `admin@medinventory.com` / `AdminSecure123!`
3. Test adding a medication
4. Test barcode scanning
5. **ANNOUNCE TO CLINIC: PharmaSys MedTrak is live!**

---

## TROUBLESHOOTING QUICK FIXES

| Problem | Fix |
|---------|-----|
| Can't connect | `nslookup your-domain.com` - wait for DNS |
| Services down | `docker-compose restart` |
| Database error | `docker-compose logs postgres` |
| Out of disk | `docker system prune -a` |
| High memory | Upgrade droplet size in DigitalOcean |

---

## IMPORTANT COMMANDS TO SAVE

```bash
# View logs
docker-compose logs -f backend

# Restart all
docker-compose restart

# Stop all
docker-compose down

# Start all
docker-compose up -d

# Backup
docker-compose exec postgres pg_dump -U meduser medication_inventory | gzip > backup.sql.gz

# Restore
docker-compose exec -i postgres psql -U meduser medication_inventory < backup.sql
```

---

## PASSWORDS & SECRETS (KEEP SAFE)
- Domain: ________________
- DigitalOcean IP: ________________
- Database Password: ________________
- JWT Secret: ________________
- Admin Email: admin@medinventory.com
- Admin Password: ________________ (change from default!)

---

**Total Deployment Time: 15-20 minutes**  
**Monthly Cost: ~$12 (includes backups, domain separate)**  
**Status After Completion: ✓ PRODUCTION LIVE**

Let me know if you hit any issues! 🚀
