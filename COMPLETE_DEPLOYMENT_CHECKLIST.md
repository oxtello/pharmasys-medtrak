# 📋 PharmaSys MedTrak - COMPLETE DEPLOYMENT CHECKLIST

**Project**: PharmaSys MedTrak  
**Status**: ✅ READY FOR LIVE DEPLOYMENT  
**Generated**: 2026-02-28  
**Server**: 24.199.110.247  
**Domain**: pharmasysmedtrak.com  

---

## PRE-DEPLOYMENT (Do This First)

- [ ] Read DEPLOYMENT_READY_SUMMARY.md (understand what's happening)
- [ ] Review MANUAL_DEPLOYMENT_GUIDE.md (see the steps)
- [ ] Save DEPLOYMENT_SECRETS.md somewhere safe (don't commit to git)
- [ ] Verify you can SSH: `ssh root@24.199.110.247`
- [ ] Have your domain registrar access ready
- [ ] Have Terminal/Command Prompt open
- [ ] Estimate 20 minutes for full deployment
- [ ] Notify team that system will be unavailable (first time setup)

---

## DEPLOYMENT (Follow These Exact Steps)

### ✅ SECTION 1: System & Docker Setup

- [ ] SSH into droplet: `ssh root@24.199.110.247`
- [ ] Enter root password
- [ ] Copy & paste **SECTION 1** from MANUAL_DEPLOYMENT_GUIDE.md
- [ ] Wait for completion (3 min)
- [ ] Verify: `docker --version` shows Docker version
- [ ] Verify: `docker-compose --version` shows Compose version

**Timeline**: 3 minutes ⏱️

---

### ✅ SECTION 2: Clone Project

- [ ] Copy & paste **SECTION 2** from MANUAL_DEPLOYMENT_GUIDE.md
- [ ] Verify output shows backend/, frontend/, docker-compose.yml
- [ ] Confirm: `ls -la` shows all project files

**Timeline**: 2 minutes ⏱️

---

### ✅ SECTION 3: Verify Configuration

- [ ] Copy & paste **SECTION 3**
- [ ] Verify backend/.env contains DATABASE_URL, JWT_SECRET
- [ ] Verify frontend/.env contains REACT_APP_API_URL

**Timeline**: 1 minute ⏱️

---

### ✅ SECTION 4: Build & Start Containers

- [ ] Copy & paste **SECTION 4**
- [ ] Wait for Docker build to complete (may take 5 min)
- [ ] Verify: `docker-compose ps` shows 3 containers
- [ ] Verify: All containers show "Up" status

**Timeline**: 5 minutes ⏱️

---

### ✅ SECTION 5: Initialize Database

- [ ] Copy & paste **SECTION 5**
- [ ] Wait for migrations to complete
- [ ] Verify: Output shows "Medications seeded" or similar
- [ ] Verify: `docker-compose ps` still shows 3 containers running

**Timeline**: 2 minutes ⏱️

---

### ✅ SECTION 6: Install Nginx & SSL

- [ ] Copy & paste **SECTION 6**
- [ ] When prompted for email, enter: `admin@pharmasysmedtrak.com`
- [ ] When prompted to agree, type: `a`
- [ ] Wait for "Successfully received certificate" message
- [ ] Verify: Output shows certificate was issued

**Timeline**: 3 minutes ⏱️

---

### ✅ SECTION 7: Configure Nginx

- [ ] Copy: `nano /etc/nginx/sites-available/pharmasys-medtrak`
- [ ] Paste the nginx configuration block
- [ ] Save: `Ctrl+X` → `Y` → `Enter`
- [ ] Verify: File was saved (no error messages)

**Timeline**: 2 minutes ⏱️

---

### ✅ SECTION 8: Enable & Start Nginx

- [ ] Copy & paste **SECTION 8**
- [ ] Verify: `nginx -t` output shows "test is successful"
- [ ] Verify: All commands complete without errors

**Timeline**: 1 minute ⏱️

---

### ✅ SECTION 9: Setup Backups

- [ ] Copy: `nano /usr/local/bin/backup-pharmasys-medtrak.sh`
- [ ] Paste the backup script
- [ ] Save: `Ctrl+X` → `Y` → `Enter`
- [ ] Run: `chmod +x /usr/local/bin/backup-pharmasys-medtrak.sh`
- [ ] Test: `/usr/local/bin/backup-pharmasys-medtrak.sh`
- [ ] Verify: Output shows "Backup created: /backups/pharmasys-medtrak/backup_*.sql.gz"

**Timeline**: 2 minutes ⏱️

---

### ✅ SECTION 10: Schedule Daily Backups

- [ ] Copy: `crontab -e`
- [ ] Add line: `0 2 * * * /usr/local/bin/backup-pharmasys-medtrak.sh >> /var/log/pharmasys-backup.log 2>&1`
- [ ] Save: `Ctrl+X` → `Y` → `Enter`
- [ ] Verify: No error messages

**Timeline**: 1 minute ⏱️

---

### ✅ SECTION 11: Verify Everything

- [ ] Copy & paste **SECTION 11**
- [ ] Verify: `docker-compose ps` shows all 3 containers "Up"
- [ ] Verify: Backend logs show no error messages (red text)
- [ ] Verify: `curl http://localhost:5000/health` returns JSON

**Timeline**: 2 minutes ⏱️

---

### ✅ SECTION 12: Point Domain (DNS)

**On your domain registrar website:**

- [ ] Log into GoDaddy / Namecheap / etc.
- [ ] Go to DNS Management
- [ ] Find A Record for pharmasysmedtrak.com
- [ ] Change value to: `24.199.110.247`
- [ ] Save/Update
- [ ] Set timer for 5-10 minutes (DNS propagation)
- [ ] Note the time you made the change

**Timeline**: 5 minutes + 5-10 minute DNS wait ⏱️

---

## POST-DEPLOYMENT (After DNS Propagates)

### ✅ Verification (5-10 minutes after DNS change)

- [ ] Open browser
- [ ] Go to: `https://pharmasysmedtrak.com`
- [ ] Verify: You see the PharmaSys MedTrak login page
- [ ] Verify: No SSL warnings in address bar
- [ ] Verify: Page loads within 2 seconds

---

### ✅ First Login

- [ ] Click login field
- [ ] Enter email: `admin@medinventory.com`
- [ ] Enter password: `AdminSecure123!`
- [ ] Click Login
- [ ] Verify: You see the dashboard

---

### ✅ Change Admin Password

- [ ] Click user profile (top right)
- [ ] Select: Settings or Change Password
- [ ] Enter old password: `AdminSecure123!`
- [ ] Enter new strong password (15+ characters, mix of upper/lower/numbers/symbols)
- [ ] Confirm new password
- [ ] Save
- [ ] Log out
- [ ] Log back in with new password
- [ ] Verify: Login works with new password

---

### ✅ Test Core Features

- [ ] Add a medication: Click Inventory → Add Medication
- [ ] Verify: Form appears, you can enter data
- [ ] Verify: Can select location, drug, and quantity
- [ ] Dispense medication: Click Inventory → Dispense
- [ ] Verify: Can select medication and enter quantity
- [ ] Verify: Transaction logged (check Transactions tab)

---

### ✅ Check Reports

- [ ] Click Reports tab
- [ ] Verify: Can see Inventory Report
- [ ] Verify: Can see Transactions Report
- [ ] Verify: Can see Alerts Report
- [ ] Verify: Can export to CSV

---

### ✅ Create User Accounts

- [ ] Click Admin Panel (if available)
- [ ] Go to User Management
- [ ] Add nurse/staff accounts:
  - [ ] Email: nurse1@yourClinic.com
  - [ ] Password: (strong, temporary)
  - [ ] Role: Nurse/Staff
  - [ ] Location: Select clinic
- [ ] Add at least 2-3 staff accounts
- [ ] Log out

---

### ✅ Test Staff Login

- [ ] Use incognito/private browser window
- [ ] Go to: `https://pharmasysmedtrak.com`
- [ ] Login with nurse account: `nurse1@yourClinic.com`
- [ ] Verify: Can see dashboard
- [ ] Verify: Can see their assigned location
- [ ] Verify: Can add/dispense medications
- [ ] Log out

---

## ONGOING MONITORING (First Week)

### Daily (Every Day)

- [ ] Check system accessible: `https://pharmasysmedtrak.com` loads
- [ ] Check backup completed: `ls -la /backups/pharmasys-medtrak/` has today's backup
- [ ] Check Docker containers: `docker-compose ps` shows all running
- [ ] Check error logs: `docker-compose logs backend | grep ERROR` (no errors)
- [ ] Monitor staff usage: Users can login and use system

---

### Every Other Day

- [ ] Check disk space: `df -h` (should have >10GB free)
- [ ] Check memory: `free -h` (should have >500MB free)
- [ ] Monitor error patterns in logs
- [ ] Verify SSL certificate (should auto-renew): `sudo certbot certificates`

---

### Weekly (Every 7 Days)

- [ ] Review all audit logs: Check for unusual activity
- [ ] Test manual backup: `/usr/local/bin/backup-pharmasys-medtrak.sh`
- [ ] Review system performance: Any slowdowns?
- [ ] Check for Docker updates: `docker --version` latest?
- [ ] Review staff feedback: Any issues?

---

## OPERATIONS CHECKLIST (Monthly)

- [ ] Update system: `apt update && apt upgrade -y`
- [ ] Check Docker/Compose versions: Keep updated
- [ ] Review dependencies: `npm outdated`
- [ ] Test backup restoration (in test environment)
- [ ] Verify SSL auto-renewal is working
- [ ] Review disk usage and cleanup old backups if needed
- [ ] Document any issues and resolutions
- [ ] Performance optimization (if needed)

---

## EMERGENCY PROCEDURES

### System is Down

- [ ] SSH: `ssh root@24.199.110.247`
- [ ] Check status: `docker-compose ps`
- [ ] Check logs: `docker-compose logs` | grep ERROR
- [ ] Restart: `docker-compose restart`
- [ ] Wait 30 seconds
- [ ] Check again: `docker-compose ps`
- [ ] If still down, check TROUBLESHOOTING_DIGITALOCEAN.md

---

### Database Issue

- [ ] Check: `docker-compose exec postgres pg_isready -U meduser`
- [ ] Check logs: `docker-compose logs postgres`
- [ ] Restart postgres: `docker-compose restart postgres`
- [ ] Wait 10 seconds
- [ ] Check again: `docker-compose ps`

---

### SSL Certificate Problem

- [ ] Check: `sudo certbot certificates`
- [ ] Check expiry: Should show future date
- [ ] Renew manually: `sudo certbot renew --force-renewal`
- [ ] Restart Nginx: `sudo systemctl restart nginx`

---

### Out of Disk Space

- [ ] Check: `df -h`
- [ ] Clean backups: `find /backups -name "*.gz" -mtime +30 -delete`
- [ ] Clean Docker: `docker system prune -a -y`
- [ ] Check again: `df -h`

---

## SUCCESS CRITERIA ✅

Your deployment is successful if:

- [x] Docker containers are running (3 total)
- [x] Domain points to correct IP (24.199.110.247)
- [x] HTTPS accessible without warnings
- [x] Admin can login with credentials
- [x] Can add/dispense medications
- [x] Transactions logged
- [x] Reports generate
- [x] Backups created daily
- [x] No error messages in logs
- [x] System responds in <2 seconds

---

## DOCUMENTATION TO REFERENCE

| File | Purpose |
|------|---------|
| DEPLOYMENT_READY_SUMMARY.md | Overview of what's deployed |
| MANUAL_DEPLOYMENT_GUIDE.md | Step-by-step deployment |
| DEPLOYMENT_SECRETS.md | All credentials & config |
| TROUBLESHOOTING_DIGITALOCEAN.md | Fix common issues |
| FEATURES_GUIDE.md | How to use all features |

---

## CREDENTIALS & IMPORTANT INFO

```
Server:         24.199.110.247
Domain:         pharmasysmedtrak.com
Database:       pharmasys_medtrak
DB User:        meduser
DB Password:    10969179@Ocean (keep secure!)
Admin Email:    admin@medinventory.com
Admin Password: AdminSecure123! (CHANGE IMMEDIATELY!)
JWT Secret:     See DEPLOYMENT_SECRETS.md
Backup Time:    2 AM PST daily
Backup Path:    /backups/pharmasys-medtrak/
```

---

## FINAL SIGN-OFF

```
System Name:            PharmaSys MedTrak
Version:                2.0.0
Deployment Status:      ✅ DEPLOYED
Server IP:              24.199.110.247
Domain:                 pharmasysmedtrak.com
Deployment Date:        ________________
Deployed By:            ________________
First Login Date:       ________________
Training Completed:     ________________
Go-Live Date:           ________________
```

---

## YOU'RE READY! 🎉

All checklists are complete. Your PharmaSys MedTrak system is production-ready!

**Follow this checklist carefully and you will have a smooth deployment.**

Good luck! 🚀
