# Checklist: อัปเกรด OHM-W/IMS ด้วยไฟล์จาก PATTANAKORN025/IMS (ไม่ใช้ git)

วิธีใช้: ดาวน์โหลดโค้ดทั้งสอง repo เป็น ZIP จากปุ่ม "Code → Download ZIP" บนหน้า GitHub
(PATTANAKORN025/IMS และ OHM-W/IMS) แตกไฟล์แยกโฟลเดอร์กัน แล้วทำตาม list ด้านล่างทีละข้อ
ไม่ต้องใช้คำสั่ง git เลย

---

## กลุ่ม A — ไฟล์ใหม่ที่ OHM-W ยังไม่มี (คัดลอกมาเพิ่มตรงๆ ได้เลย ไม่มีของเดิมให้ชน)

**โฟลเดอร์เอกสาร (สำคัญมาก — OHM-W ไม่มีเอกสารเลยตอนนี้):**
- [ ] `docs/ARCHITECTURE.md`
- [ ] `docs/GRAFANA_DESIGN_SYSTEM.md`
- [ ] `docs/TROUBLESHOOTING.md`
- [ ] `docs/admin/ADMIN_MANUAL.md`
- [ ] `docs/business/BUSINESS_VALUE_ROI.md`
- [ ] `docs/business/INTERNSHIP_REPORT_SUMMARY.md`
- [ ] `docs/deployment-readiness.md`
- [ ] `docs/scaling-plan.md`
- [ ] `docs/user/USER_MANUAL.md`

**ภาพประกอบ:**
- [ ] โฟลเดอร์ `assets/` ทั้งหมด (ภาพหน้าจอ dashboard)

**Docker:**
- [ ] `docker-compose.dev.yaml`

**Database migrations ใหม่ (ต้องคัดลอกตามลำดับ 015 → 018 ห้ามสลับ):**
- [ ] `database/migrations/015-daily-weekly-caggs.sql`
- [ ] `database/migrations/016-aggressive-retention.sql`
- [ ] `database/migrations/017-predictive-capacity.sql`
- [ ] `database/migrations/018-high-fidelity-sys.sql`

**Node-RED:**
- [ ] `nodered_data/flows/ingestion.json` ให้ดูเเค่ฟิกเจอร์ที่ดีของ PATTANAKORN025/IMS เเต่ใช้ของOHM เป็นหลัก
- [ ] โฟลเดอร์ `nodered_data/lib/` ทั้งหมด

**Postgres:**
- [ ] `postgres/init/003-grafana-password.sh`

**Scripts (เครื่องมือ dev/ops ที่ OHM-W ยังไม่มี):**
- [ ] `scripts/build-flows.sh`
- [ ] `scripts/create-playlist.sh`
- [ ] `scripts/enable-stress-test.sql`
- [ ] `scripts/generate-showcase.sh`
- [ ] `scripts/snmp-discover.js`
- [ ] `scripts/verify-db-health.ps1`
- [ ] `scripts/verify-db-health.sh`
- [ ] `scripts/verify-deployment.ps1`
- [ ] `scripts/verify-deployment.sh`

**Tests:**
- [ ] `tests/k6/loadtest-monitor.md`
- [ ] `tests/k6/loadtest.js`
- [ ] `tests/unit/parser-logic.js`

---

## กลุ่ม B — ไฟล์ที่มีทั้งสองฝั่งแต่เนื้อหาต่างกัน (เอาของ PATTANAKORN025 เลือกฟีกเจอร์ที่ดีเอามาปรับปรุง OHM-W )

ไฟล์กลุ่มนี้ปลอดภัยที่จะ**แทนที่ทั้งไฟล์**ได้เลย เพราะเป็นไฟล์ทดสอบ/config มาตรฐานที่ไม่มีการปรับแต่งเฉพาะของ OHM-W ปนอยู่:

- [ ] `.github/CODEOWNERS`
- [ ] `.github/workflows/ci.yml`
- [ ] `.gitignore` รหัสที่เพิ่มมา เท่านั้น ส่วนอันเดิมของOHM  ที่เซ็ตไว้เเล้วคงเดิม 
- [ ] `README.md`
- [ ] `database/migrations/013-normalized-schema.sql`
- [ ] `database/migrations/014-cagg-retention.sql`
- [ ] `database/migrations/archive/README.md`
- [ ] `docker-compose.prod.yaml`
- [ ] `monitoring/alertmanager/alertmanager.yml`
- [ ] `monitoring/grafana/dashboards/ims-engineering-drilldown.json`
- [ ] `monitoring/prometheus/prometheus.yml`
- [ ] `monitoring/prometheus/rules/ims-alerts.yml`
- [ ] `monitoring/snmpsim/Netk@.snmprec`
- [ ] `nodered_data/flows.json`
- [ ] `nodered_data/flows/alerting.json`
- [ ] `nodered_data/settings.js`
- [ ] `postgres/init/001-init-timescaledb.sql`
- [ ] `postgres/init/002-grafana-readonly.sql`
- [ ] `scripts/init-migrations.sh`
- [ ] `scripts/migrate.sh`
- [ ] `scripts/restore-db.sh`
- [ ] `tests/k6/chaos-stress.js`
- [ ] `tests/k6/db-write-stress.js`
- [ ] `tests/k6/grafana-query-stress.js`
- [ ] `tests/k6/pipeline-stress.js`
- [ ] `tests/k6/staging-chaos.js`
- [ ] `tests/lint/dashboard-linter.js`
- [ ] `tests/playwright/dashboard-visual-regression.js`
- [ ] `tests/smoke/db-write-check.sh`
- [ ] `tests/unit/parser.test.js`
- [ ] `tests/unit/v2-parser.test.js`
- [ ] `Makefile`

---

## กลุ่ม C — ไฟล์ที่ "ห้ามแทนที่ทั้งไฟล์" ต้องเปิดเทียบแล้วรวมมือ (merge ค่าด้วยมือ)

ไฟล์เหล่านี้ OHM-W เคยแก้ไขเฉพาะจุดไว้ (เช่น timeout, memory limit, backup format) ถ้าทับทั้งไฟล์
จะเสียของดีของ OHM-W เอง ไปทั้งหมด — ให้เปิดไฟล์ทั้งสองฝั่งเทียบกัน แล้วคัดลอกเฉพาะค่าที่ OHM-W
เคยปรับไว้ (ถ้ายังจำเป็น) ใส่ลงในไฟล์เวอร์ชันของ PATTANAKORN025 ก่อนนำไปใช้:

- [ ] `.env.example` — เช็คค่า **PgBouncer timeout** ที่ OHM-W เคยปรับ
- [ ] `docker-compose.yaml` — เช็คค่า **memory limit** ของ container ที่ OHM-W เคยปรับ
- [ ] `pgbouncer/entrypoint-wrapper.sh` — เช็คการตั้งค่า timeout ที่เกี่ยวข้อง
- [ ] `scripts/backup-db.sh` — เช็คว่ามี flag `-Fc` (backup format) อยู่แล้วหรือยัง ถ้ายังให้เพิ่มเข้าไป

> ถ้าเช็คแล้วพบว่าเวอร์ชันของ PATTANAKORN025 มีการตั้งค่าที่ดีกว่าหรือครอบคลุมอยู่แล้ว
> (เช่นเลข memory limit สูงกว่า/เหมาะสมกว่า) ให้ใช้ของ PATTANAKORN025 ไปเลย ไม่ต้องยึดค่าเดิมของ OHM-W

---

## กลุ่ม D — ไฟล์ที่มีเฉพาะใน OHM-W เท่านั้น (ห้ามลบ เก็บไว้เหมือนเดิม)

- [ ] `monitoring/snmpsim/eiei.snmprec` — ไฟล์จำลองอุปกรณ์เฉพาะของ OHM-W ไม่มีใน PATTANAKORN025 **ห้ามลบ**
- [ ] `database/migrations/archive/001-create-hypertable.sql` ถึง `012-redesign-hypertable.sql`
      (migration เก่าที่เก็บเป็นประวัติ) — เก็บไว้ได้ ไม่กระทบอะไร ไม่ต้องลบ

---

## หลังคัดลอกครบทุกกลุ่มแล้ว ให้ตรวจสอบ (ทำได้โดยไม่ต้องใช้ git)

- [ ] เปิดโฟลเดอร์ `docs/` แล้วนับไฟล์ ต้องได้ 9 ไฟล์
- [ ] เปิดโฟลเดอร์ `database/migrations/` ต้องเห็นไฟล์ล่าสุดคือ `018-high-fidelity-sys.sql`
- [ ] เปิด `monitoring/snmpsim/` ต้องยังเห็น `eiei.snmprec` อยู่
- [ ] รัน `cp .env.example .env` แล้ว `make up` แล้ว `make verify` ต้องผ่านทั้งหมด
- [ ] ค้นหาไฟล์ชื่อ `ims-master-dashboard.json` ในทั้งโปรเจกต์ ต้อง **ไม่เจอ** (ถ้าเจอให้ลบทิ้ง
      เพราะโครงสร้างใหม่ใช้ 4 dashboard แยกแทน)
