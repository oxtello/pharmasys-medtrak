# DigitalOcean Droplet Creation - QUICK REFERENCE

## 5-MINUTE SETUP CHECKLIST

### BEFORE YOU START
- [ ] DigitalOcean account created (or sign up)
- [ ] Payment method added
- [ ] Email verified

---

### DURING CREATION (On DigitalOcean Dashboard)

#### Step 1: Open Create Menu
```
Click: Create (green, top-right)
       → Droplets
```

#### Step 2: Configure Droplet
| Setting | Choice | Why |
|---------|--------|-----|
| **Region** | Closest to you | Lower latency |
| **Image** | Ubuntu 24.04 x64 | Latest stable OS |
| **Size** | $7.50/month (2GB/1CPU) | Perfect for 11-50 users |
| **Auth** | Password | Easiest for beginners |
| **Backups** | Daily ✓ | Data protection |

#### Step 3: Finalize
```
Quantity:   1
Hostname:   pharmasys-medtrak-prod
Tags:       (optional)
Project:    (leave default)
```

#### Step 4: Create
```
Click: "Create Droplet" button
Wait: 1-2 minutes
```

---

### AFTER CREATION

#### Get Your IP Address
```
Look at your new droplet page
Copy the IP address (e.g., 123.45.67.89)
```

#### Connect to Droplet
```
Method 1 - Console (easiest):
  Click "Console" button on droplet page
  Login: root / your-password

Method 2 - SSH (from computer):
  ssh root@123.45.67.89
  Enter password when prompted
```

#### Verify It Works
```bash
# Run on your droplet:
uname -a

# Should show: Linux ... Ubuntu ... x86_64
# If yes, ✓ You're ready!
```

---

## WHAT TO SAVE

```
┌─────────────────────────────────┐
│ DROPLET INFORMATION             │
├─────────────────────────────────┤
│ IP Address:   123.45.67.89      │
│ Hostname:     pharmasys-medtrak │
│ Username:     root              │
│ Password:     (your password)   │
│ Region:       (your region)     │
│ Created:      (date/time)       │
└─────────────────────────────────┘
```

---

## TROUBLESHOOTING QUICK FIXES

| Problem | Fix |
|---------|-----|
| Can't login | Wait 2 min, refresh, try again |
| Console shows nothing | Droplet still booting, wait 1 min |
| Wrong region | Create new in correct region, delete old |
| Forgot password | Dashboard → Droplet Actions → Reset |
| Want to resize | Dashboard → Resize tab → choose size |

---

## PRICING CHECK

```
Droplet:        $7.50/month
Backups:        $1.50/month (if enabled)
────────────────────────────
TOTAL:          ~$9.00/month

Yearly:         ~$108
```

✓ Very affordable for production system!

---

## NEXT STEPS AFTER DROPLET IS READY

1. **Tell me your IP address**
   - Format: 123.45.67.89

2. **Provide your domain name**
   - Example: medtrak.yourdomain.com

3. **Generate secrets** (run on your computer):
   ```bash
   # JWT Secret
   openssl rand -hex 32
   
   # Database Password
   openssl rand -hex 16
   ```

4. **I will**:
   - Create .env files
   - Build Docker containers
   - Give you deployment commands

5. **You will**:
   - SSH into droplet
   - Run deployment commands
   - PharmaSys MedTrak goes LIVE! 🚀

---

## SUPPORT LINKS

- **DigitalOcean Docs**: https://docs.digitalocean.com/
- **Create Droplet Guide**: https://docs.digitalocean.com/products/droplets/how-to/create/
- **SSH Connection**: https://docs.digitalocean.com/products/droplets/how-to/connect-with-ssh/
- **Support Center**: https://cloud.digitalocean.com/support

---

## I'M READY TO CREATE!

1. Go to: https://cloud.digitalocean.com/
2. Follow the settings table above
3. Click Create
4. Give me your IP address
5. We deploy! 🎯

**Estimated time: 10-15 minutes total**
