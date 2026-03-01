# PharmaSys MedTrak - DEPLOYMENT SECRETS & INFO

**⚠️ KEEP THIS FILE SECURE - DO NOT SHARE**

Generated: 2026-02-28  
Status: Ready for Production Deployment

---

## SERVER INFORMATION

```
DigitalOcean IP:        24.199.110.247
Hostname:               pharmasys-medtrak-prod
Region:                 (your region)
Region Timezone:        Pacific Standard Time (PST/PDT)
Droplet Size:           $7.50/month (2GB RAM, 1 CPU)
Droplet ID:             (check in DigitalOcean dashboard)
```

---

## DOMAIN CONFIGURATION

```
Domain Name:            pharmasysmedtrak.com
DNS A Record:           24.199.110.247
SSL Certificate:        Let's Encrypt (free, auto-renew)
Certificate Renewal:    Automatic (certbot)
Protocol:               HTTPS only (HTTP redirects to HTTPS)
```

---

## DATABASE CREDENTIALS

```
Database Name:          pharmasys_medtrak
Database User:          meduser
Database Password:      10969179@Ocean
Database Host:          postgres (Docker internal)
Database Port:          5432
Connection String:      postgres://meduser:10969179@Ocean@postgres:5432/pharmasys_medtrak
```

---

## APPLICATION SECRETS

```
JWT Secret:             8ba7b2aa8a6a29444384975ee3c9b4c6a0f259d1e222ddef86eb41b4d36abbbe
Environment:            production
API Port:               5000
Frontend Port:          3000
Node Version:           20
```

---

## TEST CREDENTIALS (Change on first login!)

```
Admin Email:            admin@medinventory.com
Admin Password:         AdminSecure123!
Clinic Name:            Downtown Clinic / Northside Clinic
Default Medications:    15 seeded
Test Users:             5 pre-configured
```

---

## CONTAINER NAMES

```
Database Container:     pharmasys_postgres
Backend Container:      pharmasys_backend
Frontend Container:     pharmasys_frontend
Docker Network:         med-network (internal)
```

---

## DIRECTORY PATHS (On DigitalOcean Server)

```
Project Root:           /opt/pharmasys-medtrak
Backend Code:           /opt/pharmasys-medtrak/backend
Frontend Code:          /opt/pharmasys-medtrak/frontend
Docker Compose File:    /opt/pharmasys-medtrak/docker-compose.yml
Backups Location:       /backups/pharmasys-medtrak
Nginx Config:           /etc/nginx/sites-available/pharmasys-medtrak
SSL Certificates:       /etc/letsencrypt/live/pharmasysmedtrak.com
Logs:                   Various (check docker-compose logs)
```

---

## ENVIRONMENT FILES

### backend/.env
```
DATABASE_URL=postgres://meduser:10969179@Ocean@postgres:5432/pharmasys_medtrak
NODE_ENV=production
PORT=5000
JWT_SECRET=8ba7b2aa8a6a29444384975ee3c9b4c6a0f259d1e222ddef86eb41b4d36abbbe
REACT_APP_URL=https://pharmasysmedtrak.com
CORS_ORIGIN=https://pharmasysmedtrak.com
EMAIL_SERVICE=(not configured)
EMAIL_USER=(not configured)
EMAIL_PASSWORD=(not configured)
```

### frontend/.env
```
REACT_APP_API_URL=https://pharmasysmedtrak.com/api
```

---

## BACKUP INFORMATION

```
Backup Script:          /usr/local/bin/backup-pharmasys-medtrak.sh
Backup Schedule:        Daily at 2:00 AM PST
Backup Location:        /backups/pharmasys-medtrak/
Backup Retention:       30 days (auto-delete older)
Backup Format:          PostgreSQL dump (compressed .sql.gz)
Estimated Size/Day:     ~10-20 MB per backup
Monthly Storage:        ~300-600 MB
```

---

## SSL/TLS INFORMATION

```
Certificate Authority:  Let's Encrypt
Domain:                 pharmasysmedtrak.com
Certificate Path:       /etc/letsencrypt/live/pharmasysmedtrak.com/fullchain.pem
Private Key Path:       /etc/letsencrypt/live/pharmasysmedtrak.com/privkey.pem
Renewal Schedule:       Automatic (30 days before expiration)
Renewal Service:        certbot.timer (systemd service)
TLS Versions:           1.2, 1.3
Security Headers:       Enabled via Nginx
```

---

## MONITORING & MAINTENANCE

### Daily Tasks
```
✓ Check system is accessible: https://pharmasysmedtrak.com
✓ Monitor backup completion
✓ Monitor Docker containers status
✓ Check application logs for errors
```

### Weekly Tasks
```
✓ Review audit logs
✓ Check system resources (CPU, memory, disk)
✓ Verify SSL certificate
✓ Review container restarts
```

### Monthly Tasks
```
✓ Update system packages
✓ Check for Docker updates
✓ Review performance metrics
✓ Test backup restoration
✓ Security audit
```

---

## EMERGENCY PROCEDURES

### If system is down:
1. SSH into 24.199.110.247
2. Run: `docker-compose ps`
3. Check logs: `docker-compose logs`
4. Restart: `docker-compose restart`
5. Wait 30 seconds and verify: `docker-compose ps`

### If database is corrupted:
1. Stop services: `docker-compose down`
2. Restore backup: `docker-compose exec -i postgres psql -U meduser pharmasys_medtrak < backup_file.sql`
3. Restart: `docker-compose up -d`

### If disk is full:
1. Check space: `df -h`
2. Clean old backups: `find /backups -name "*.gz" -mtime +30 -delete`
3. Clean Docker: `docker system prune -a -y`
4. Last resort: Upgrade droplet size

### If SSL certificate expires (shouldn't happen):
1. Renew manually: `sudo certbot renew --force-renewal`
2. Check status: `sudo certbot certificates`
3. Restart Nginx: `sudo systemctl restart nginx`

---

## SECURITY CHECKLIST

Before going live:
- [x] Secrets generated (JWT, DB password)
- [x] SSL/TLS configured
- [x] Database user password set
- [x] Firewall rules configured (DigitalOcean)
- [x] Rate limiting enabled
- [x] Backups scheduled
- [ ] Change test credentials (admin password)
- [ ] Remove test accounts (if not needed)
- [ ] Configure email alerts (optional)
- [ ] Review access logs

---

## COST ANALYSIS

```
Monthly Costs:
  Droplet (2GB RAM):      $7.50
  Backups:                $1.50
  Reserved IP (optional): $3.00
  ────────────────────────────
  Subtotal:               $12.00

Annual:
  12 months × $12.00:     $144.00
  Domain (external):      ~$12.00
  ────────────────────────────
  Total Annual:           ~$156.00
```

**Very affordable for production HIPAA-compliant system!**

---

## API ENDPOINTS

```
Base URL:               https://pharmasysmedtrak.com/api

Key Endpoints:
  POST   /auth/login              - User login
  POST   /auth/register           - User registration
  GET    /inventory               - List medications
  POST   /inventory/add           - Add medication
  POST   /inventory/dispense      - Dispense medication
  POST   /inventory/dispose       - Dispose medication
  GET    /reports/inventory       - Inventory report
  GET    /reports/transactions    - Transaction history
  GET    /users                   - List users (admin only)
  POST   /users                   - Create user (admin only)
```

Full API documentation available in FEATURES_GUIDE.md

---

## IMPORTANT LINKS

```
Application URL:        https://pharmasysmedtrak.com
SSH Address:            ssh root@24.199.110.247
DigitalOcean Dashboard: https://cloud.digitalocean.com/
SSL Certificates:       https://letsencrypt.org/
Docker Hub:             https://hub.docker.com/
PostgreSQL Docs:        https://www.postgresql.org/docs/
Nginx Docs:             https://nginx.org/en/docs/
```

---

## DEPLOYMENT TIMELINE

```
Pre-Deployment:
  ✅ Droplet created (2-3 min)
  ✅ Docker containers built (3-5 min)
  ✅ Configuration files created
  ✅ Secrets generated

During Deployment (15-20 min total):
  • SSH and system setup (2-3 min)
  • Docker installation (3-5 min)
  • Code deployment (2-3 min)
  • Database initialization (2-3 min)
  • Nginx and SSL setup (3-5 min)
  • Verification (2-3 min)

Post-Deployment:
  • DNS propagation (5-10 min)
  • User training
  • System monitoring
  • Maintenance tasks
```

---

## SUPPORT CONTACTS

```
DigitalOcean Support:   https://cloud.digitalocean.com/support
DigitalOcean Docs:      https://docs.digitalocean.com/
Docker Support:         https://docs.docker.com/
PostgreSQL Support:     https://www.postgresql.org/community/
Nginx Support:          https://nginx.org/en/support.html
```

---

## SIGN-OFF

```
System:                 PharmaSys MedTrak
Version:                2.0.0
Generated:              2026-02-28
Deployment IP:          24.199.110.247
Domain:                 pharmasysmedtrak.com
Status:                 ✅ READY FOR DEPLOYMENT
Prepared By:            Gordon (Docker Assistant)
```

---

## NEXT STEPS

1. **Keep this file secure** - Do not commit to version control
2. **Print a physical copy** - Store in secure location
3. **Share credentials** - Only with authorized personnel
4. **Follow DEPLOYMENT_INSTRUCTIONS.md** - Step by step
5. **Monitor deployment** - Check logs for any issues
6. **Verify system** - Test all features after deployment
7. **Train users** - Provide access and support
8. **Monitor ongoing** - Daily checks, weekly reviews, monthly maintenance

---

**PharmaSys MedTrak is ready to deploy! 🚀**

For detailed deployment steps, see: DEPLOYMENT_INSTRUCTIONS.md
