# Backup & Disaster Recovery (100K+ Users)

## Backup Strategy

### Supabase PostgreSQL (Primary)

**Automatic Backups (Enabled by default):**
- Daily backups: 7-day retention
- Upgrade to 30-day for enterprise

**Access via Supabase Dashboard:**
```
Database → Backups → Download backup
```

**Manual Backup:**
```bash
# Full backup
pg_dump -h db.supabase.co -U postgres -d postgres > lyra_backup.sql

# With compression (smaller file)
pg_dump -h db.supabase.co -U postgres -d postgres | gzip > lyra_backup.sql.gz

# Specific table only
pg_dump -h db.supabase.co -U postgres -d postgres -t users > users_backup.sql
```

### Restore from Backup

**Via Supabase Dashboard:**
```
Database → Backups → [Select backup] → Restore
```

**Via psql:**
```bash
# Drop existing database (CAREFUL!)
psql -h db.supabase.co -U postgres -c "DROP DATABASE lyra;"

# Restore
psql -h db.supabase.co -U postgres < lyra_backup.sql.gz

# Restore specific table
psql -h db.supabase.co -U postgres -d lyra < users_backup.sql
```

---

## Disaster Recovery Plan (RTO/RPO)

| Scenario | RTO | RPO | Recovery Steps |
|----------|-----|-----|---|
| **Database corruption** | 15 min | 1 hour | Point-in-time restore from Supabase backup |
| **Data deletion** | 30 min | 24 hours | Full database restore |
| **Regional outage** | 5 min | 0 | Failover to different region (Vercel handles) |
| **API code issue** | 2 min | 0 | Revert to previous deployment (Vercel history) |

**RTO** = Recovery Time Objective (how fast to restore)
**RPO** = Recovery Point Objective (data loss acceptable)

---

## Automated Backup Script

```bash
#!/bin/bash
# backup.sh — Daily automated backup to S3

DATE=$(date +%Y-%m-%d)
BACKUP_FILE="lyra_backup_${DATE}.sql.gz"

# Backup database
pg_dump -h db.supabase.co -U postgres -d postgres | \
  gzip > "/tmp/${BACKUP_FILE}"

# Upload to S3
aws s3 cp "/tmp/${BACKUP_FILE}" \
  s3://lyra-backups/${BACKUP_FILE} \
  --sse AES256

# Cleanup local
rm "/tmp/${BACKUP_FILE}"

# Verify (optional)
aws s3 ls s3://lyra-backups/ | tail -5

echo "Backup complete: ${BACKUP_FILE}"
```

**Schedule with cron:**
```bash
0 2 * * * /path/to/backup.sh
```

Runs at 2 AM daily.

---

## Point-in-Time Recovery (PITR)

**Supabase enables automatic WAL archiving.**

Recover to any point within 7 days:

```sql
-- Via Supabase dashboard:
-- Database → Backups → "Restore point-in-time"
-- Select timestamp: 2026-03-25 14:30:00
```

---

## S3 Backup Storage (Optional)

For critical data, backup to AWS S3:

**Setup:**
```bash
# 1. Create S3 bucket
aws s3 mb s3://lyra-backups

# 2. Enable versioning
aws s3api put-bucket-versioning \
  --bucket lyra-backups \
  --versioning-configuration Status=Enabled

# 3. Enable encryption
aws s3api put-bucket-encryption \
  --bucket lyra-backups \
  --server-side-encryption-configuration \
  'Rules=[{ApplyServerSideEncryptionByDefault={SSEAlgorithm=AES256}}]'

# 4. Enable lifecycle (auto-delete old backups)
aws s3api put-bucket-lifecycle-configuration \
  --bucket lyra-backups \
  --lifecycle-configuration \
  'Rules=[{Prefix=lyra_backup,Status=Enabled,Expiration={Days=90}}]'
```

---

## Redis Cache Recovery

**Redis data is ephemeral** (can be lost without data loss).

If Redis data lost:
1. Rate limiting resets (in-memory fallback)
2. Cache clears (slight performance hit)
3. Auto-rebuilds from API responses

**No action needed** — graceful degradation handles it.

---

## Monitoring Backup Health

### Weekly Backup Test

```bash
#!/bin/bash
# test_backup.sh — Verify backups are working

LATEST_BACKUP=$(aws s3 ls s3://lyra-backups/ | tail -1 | awk '{print $4}')

if [ -z "$LATEST_BACKUP" ]; then
    echo "ERROR: No backup found!"
    exit 1
fi

AGE_HOURS=$((( $(date +%s) - $(date -d "$LATEST_BACKUP" +%s) ) / 3600))

if [ $AGE_HOURS -gt 24 ]; then
    echo "WARNING: Backup is ${AGE_HOURS} hours old!"
    exit 1
fi

echo "OK: Latest backup is ${AGE_HOURS} hours old"
exit 0
```

Run weekly via monitoring tool.

---

## Disaster Recovery Checklist

### Before Going Live (1 week before)

- [ ] Configure Supabase daily backups
- [ ] Test restore process (restore to test database)
- [ ] Setup S3 bucket for backups
- [ ] Configure backup script + cron
- [ ] Document recovery procedures
- [ ] Train team on recovery steps

### Weekly

- [ ] Verify latest backup timestamp
- [ ] Test restore from backup (not production!)
- [ ] Check backup size (track growth)

### Monthly

- [ ] Full disaster recovery drill (practice restore)
- [ ] Verify S3 backups accessible
- [ ] Review and update RTO/RPO targets

### Annually

- [ ] Audit entire backup system
- [ ] Update recovery documentation
- [ ] Test recovery at scale (if possible)

---

## Incident Response

### Step 1: Assess Situation

```bash
# Check database status
psql -h db.supabase.co -U postgres -c "SELECT version();"

# Check Vercel deployment status
vercel env list

# Check Sentry for errors
# https://sentry.io/organizations/[org]/issues/
```

### Step 2: Communicate

- Notify users on status page
- Alert team in Slack/Discord
- Post to community (if applicable)

### Step 3: Recover

**If database issue:**
```bash
# Point-in-time restore
# Via Supabase dashboard: Database → Backups → Restore to [timestamp]
# Takes ~15 minutes
```

**If code issue:**
```bash
# Revert to previous working deployment
vercel rollback

# Or redeploy from git
git revert HEAD
git push
vercel --prod
```

### Step 4: Verify

```bash
# Test critical endpoints
curl https://api.your-domain.com/health

# Check error rates (Sentry)
# Check performance (Vercel dashboard)
```

### Step 5: Post-Mortem

- Document what happened
- Identify root cause
- Add monitoring/alerts to prevent
- Update runbooks

---

## Backup Costs

| Service | Usage | Cost/Month |
|---------|-------|----------|
| Supabase daily backups | 7-day retention | $0 (included) |
| S3 storage (90 days) | ~30 backups × 500MB | $15-20 |
| S3 transfer (download for restore) | 1 restore/month | $1-2 |
| **Total** | | **$15-25** |

---

## Recovery Time Examples

### Scenario: Data Deletion

**Timeline:**
- t=0: User reports missing data
- t=5min: Confirm data loss in logs
- t=10min: Initiate point-in-time restore to 2h ago
- t=25min: Restore complete, verify data
- t=30min: Service restored, notify users

**Total RTO: 30 minutes**
**Data loss: 2 hours of conversations**

### Scenario: Database Corruption

**Timeline:**
- t=0: Error rate spike detected (Sentry)
- t=2min: Verify database query failures
- t=5min: Initiate full backup restore
- t=20min: Restore complete
- t=25min: Service restored

**Total RTO: 25 minutes**
**Data loss: 30 minutes (last backup)**

---

## Tools & Resources

- **Supabase Backups:** https://supabase.com/docs/guides/database/backups
- **PostgreSQL Backup:** https://www.postgresql.org/docs/current/backup.html
- **AWS S3:** https://aws.amazon.com/s3/
- **Point-in-Time Recovery:** https://supabase.com/blog/postgres-point-in-time-recovery

---

## Future Improvements

1. **Cross-region backup:** Automated backup to different AWS region
2. **Backup verification:** Automated restore tests to ensure backups work
3. **Encrypted backups:** GPG encryption for sensitive backups
4. **Alert monitoring:** Slack alerts when backups fail
5. **Compliance reports:** Automatic backup audit logs

---

**Last Updated:** 2026-03-30
**Next Review:** 2026-04-30
