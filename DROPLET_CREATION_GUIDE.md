# PharmaSys MedTrak - DigitalOcean Droplet Setup Guide

## STEP 1: Create DigitalOcean Account (if needed)

1. Go to: https://cloud.digitalocean.com/registrations/new
2. Sign up with email or GitHub/Google account
3. Add a payment method (credit card)
4. Verify your email

---

## STEP 2: Create Your Droplet

### 2.1 Go to the Control Panel
1. Log in to: https://cloud.digitalocean.com/
2. Click **Create** button (top-right, green button)
3. Select **Droplets**

### 2.2 Choose Your Settings

**1. Choose Region** (Pick closest to your clinic)
- Examples: New York (nyc1), San Francisco (sfo1), London (lon1)
- ✓ Just pick any region close to you

**2. Choose Image**
- Click **OS** tab
- Select **Ubuntu**
- Select **Ubuntu 24.04 x64** ← IMPORTANT
- ✓ This is the OS for your server

**3. Choose Size**
- Look for **Basic** plans (left side)
- Select **$7.50/month** plan
  - Shows: "2 GB / 1 CPU / 50 GB SSD"
- ✓ This is perfect for 11-50 users

**4. Authentication Method**
- Choose **Password** (easier for beginners)
- OR choose **SSH key** if you have one
- ✓ Password is fine for now

**5. Advanced Options** (Optional but recommended)
- Check **Enable automated backups**
  - Daily Backups recommended
- ✓ Keeps your data safe

**6. Finalize Details**
- **Quantity**: 1
- **Hostname**: `pharmasys-medtrak-prod`
- **Tags**: optional (leave blank)
- **Project**: optional (default is fine)

### 2.3 Create the Droplet

1. Click **Create Droplet** button (bottom)
2. Wait 1-2 minutes for creation
3. ✓ You'll see a progress bar

---

## STEP 3: Get Your Droplet IP Address

After creation completes:

1. You'll see a screen with your new droplet
2. Look for **Your Droplet IP Address**
3. It looks like: `123.45.67.89`
4. **Copy this IP address** - you'll need it for deployment

---

## STEP 4: Connect to Your Droplet

### If you chose Password authentication:

1. On the droplet page, click **Console** (top-right)
2. Login:
   - **Username**: `root`
   - **Password**: (the one you set during creation)
3. ✓ You're now connected!

### If you chose SSH key:

From your computer terminal:
```bash
ssh root@YOUR_IP_ADDRESS
# Replace YOUR_IP_ADDRESS with actual IP (e.g., 123.45.67.89)
```

---

## STEP 5: Verify Your Droplet is Ready

Run this command on your droplet to confirm:

```bash
uname -a
```

You should see output like:
```
Linux pharmasys-medtrak-prod 6.x.x-xxx-generic #xxx-Ubuntu SMP ... x86_64 GNU/Linux
```

✓ Great! Your droplet is ready for PharmaSys MedTrak deployment.

---

## YOUR DROPLET INFO (Save this!)

Fill in your info below and save for deployment:

```
Droplet IP Address:     123.45.67.89
Droplet Hostname:       pharmasys-medtrak-prod
Region:                 (your region)
Authentication:         Password / SSH Key
Root Password:          (your password)
Backups Enabled:        Yes / No
Created Date:           ________________
```

---

## NEXT STEPS

Once your droplet is created and you have the IP address:

1. **Provide the IP address** to your deployment team
2. **Generate JWT Secret** (if not done yet):
   ```bash
   openssl rand -hex 32
   ```
3. **Generate Database Password** (if not done yet):
   ```bash
   openssl rand -hex 16
   ```
4. **Provide your domain name** for PharmaSys MedTrak
5. **Ready for deployment!**

---

## TROUBLESHOOTING

**Issue: Can't connect to Console**
- Wait 2-3 minutes for droplet to fully boot
- Try refreshing the page
- Restart the droplet from dashboard

**Issue: Password forgotten**
- Go to your droplet page
- Click **Droplet Actions** → **Password Reset**
- Follow the email instructions

**Issue: Wrong region selected**
- Create another droplet in the correct region
- Delete the wrong one later

---

## COST CHECK

Before proceeding, verify your billing:
- Droplet: $7.50/month
- Backups: ~$1.50/month (if enabled)
- **Total: ~$9/month**

✓ Check your DigitalOcean Dashboard → Billing to confirm

---

## Ready to Deploy?

Once you have:
✅ Droplet IP address
✅ Access to your droplet (Console or SSH)
✅ Domain name
✅ JWT Secret (generated)
✅ Database Password (generated)

**Let me know and we'll deploy PharmaSys MedTrak!**

---

## Questions?

- **DigitalOcean Help**: https://docs.digitalocean.com/products/droplets/
- **Chat with Support**: Available in DigitalOcean dashboard

**You're all set to create your droplet!** 🚀
