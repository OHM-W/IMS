# 🏭 IMS (Industrial NOC Monitoring System) - Project Summary

## 📋 1. ภาพรวมโครงการ (Project Overview)
**IMS** คือระบบ Real-time Monitoring สำหรับ IT Infrastructure ระดับ Enterprise ออกแบบมาเพื่อใช้งานที่ APEX Circuit 
เป้าหมายหลักคือการรักษาระดับ SLA ที่ ~99% (ด้วยสถาปัตยกรรมแบบ single-instance), การประมวลผลข้อมูลแบบ Zero-Leak memory, และการแจ้งเตือนล่วงหน้าแบบ Predictive AIOps

โครงการนี้ได้ออกเวอร์ชัน **1.0.0 (Production Release)** เรียบร้อยแล้ว รองรับการทำ Device Registry (จัดการเครื่อง 1-1000+ เครื่องผ่าน Database), มี Grafana Dashboards 4 แบบ, และกฎการแจ้งเตือน (Alert Rules) ถึง 38 กฎ

## 🏗️ 2. สถาปัตยกรรมและ Tech Stack (Architecture)
สถาปัตยกรรมเป็นแบบ Data Pipeline ที่ไหลจากอุปกรณ์ไปสู่ Dashboard และ Alert:

1. **Data Collection**: อุปกรณ์ Network/Servers → ส่งข้อมูลผ่าน SNMP v2c/v3
2. **Data Pipeline**: **Node-RED** (ใช้สถาปัตยกรรมแบบ 5-Thread Parallel Walker ดึงข้อมูล CPU, Storage, Network, Temp, LDI)
3. **Database (Storage)**: **TimescaleDB** (PostgreSQL) เพื่อจัดเก็บข้อมูลแบบ Time-series โดยมี **PgBouncer** เป็น Connection Pooler (Transaction Mode)
4. **Visualization**: **Grafana** (ดึงข้อมูลจาก Continuous Aggregates ของ TimescaleDB)
5. **Alerting & SRE**: **Prometheus** (ดึง Metrics ต่างๆ รวมทั้ง Node-RED self-monitoring และ SLA Probes จาก Blackbox Exporter) → **Alertmanager** (จัดการการแจ้งเตือน, Webhooks)

## ⚠️ 3. กฎเกณฑ์ที่เข้มงวด (The Ironclad Rules & Gotchas)
ระบบนี้มีข้อควรระวังในการพัฒนาที่ต้องปฏิบัติตามอย่างเคร่งครัด:

* **Node-RED**:
    * **ห้ามใช้** โหนด SNMP (GET) ธรรมดาแบบต่อคิว ให้ใช้แบบ 5 ท่อขนาน (Parallel Walker)
    * `nodered_data/flows/ingestion.json` คือ Source of Truth 
    * การแก้ไข Flow ห้ามใช้ PowerShell `ConvertTo-Json` เด็ดขาดเพราะจะทำให้ `\n` พัง ให้แก้ไฟล์ JSON โดยระวังเรื่อง escape sequences
    * การจัดการ Memory: ต้องทำการ Explicit Garbage Collection เสมอ (`flatData.length = 0` และ `msg.payload = null`)
* **Database (TimescaleDB / PostgreSQL)**:
    * ใช้ `public` schema เท่านั้น ห้ามใช้ `ims.*`
    * Grafana ต้อง Query จาก **Continuous Aggregates** (`telemetry_minute_summary`, `telemetry_hourly_summary`) เสมอ ยกเว้นคอลัมน์ `interface_metrics` ที่เป็น jsonb
    * การ Migration ห้ามครอบด้วย `BEGIN/COMMIT` เนื่องจากคำสั่งสร้าง Continuous Aggregate ไม่สามารถทำงานใน Transaction Block ได้
    * PgBouncer ใช้ `transaction` pooling mode (ห้ามใช้ Prepared Statements)
* **Grafana**:
    * ห้ามใช้ `$__interval` ตรงๆ ใน SQL ให้ใช้ `$__timeGroupAlias("time", $__interval)`
    * กราฟ Symmetrical network ต้องมี `axisCenteredZero: true` และค่าอัปโหลดต้องคูณ `-1`

## 🚀 4. สถานะปัจจุบันและสิ่งที่ต้องทำต่อ (Current State & Next Steps)
**สถานะปัจจุบัน:** โปรเจ็กต์ค่อนข้างเสถียรที่ v1.0.0 ผ่านการทดสอบ Load Test ด้วย K6 (1,000 VUs, failure 0%, p95 < 80ms) มี CI/CD Pipeline เรียบร้อย

**สิ่งที่ต้องทำต่อ (Next Steps / Technical Debt) ที่พบจากโครงสร้างโปรเจ็กต์:**
1. **Prometheus Z-Score Alert Rules**: ปัจจุบันระบบ Anomaly Detection (Z-Score) มีแสดงผลแค่บนกราฟ Grafana ผ่าน SQL เท่านั้น ยังไม่ได้ถูกเขียนเป็น `stddev_over_time` PromQL rules ใน Prometheus (มีการทิ้ง Comment "FOLLOW-UP" ไว้)
2. **Real LDI Machine Integration**: ข้อมูล LDI (Enterprise OID `.9999`) ปัจจุบันเป็นการจำลอง (Mocked) ผ่าน SNMP Simulator ต้องเตรียมการขอ MIB ของจริงจากผู้จัดจำหน่าย YSPhotec เพื่อเชื่อมต่อกับเครื่องจักรจริง
3. **Node-RED Version Upgrade**: ปัจจุบัน Node-RED อยู่ที่เวอร์ชัน 4.0.5 ซึ่งเก่าไปสอง Major Versions การจะอัปเกรดเป็น 5.0 ต้องอัปเกรด Node.js เป็น 22.9+ ด้วย ซึ่งมี Breaking changes ที่ต้องวางแผนทดสอบ
4. **Code Cleanup**: มีไฟล์ Script ชั่วคราว (`_tmp_add_k6_endpoint.js`, `_tmp_fix_nr_port.js`, `_tmp_old_k6.js`) ที่น่าจะเกิดจากการทดสอบและแก้ไขเร็วๆ นี้ ควรพิจารณาลบทิ้งหรือจัดระเบียบให้เรียบร้อย
5. **Scaling**: ดำเนินการตามเอกสาร `docs/scaling-plan.md` เพื่อรองรับเครื่องจักรมากกว่า 1,000+ เครื่องในอนาคต

## 📂 5. โครงสร้างโฟลเดอร์สำคัญ
* `node-red/flows/`: เก็บไฟล์ JSON ของ Flow ข้อมูล (แยก Ingestion และ Alerting)
* `monitoring/`: เก็บ Config ของ Grafana (Dashboards/Provisioning), Prometheus (Rules), และ SNMP Simulator
* `database/migrations/`: ไฟล์ SQL สำหรับจัดการโครงสร้าง TimescaleDB
* `tests/k6/`: Script ทดสอบ Load/Stress testing
* `docker-compose.yaml` (และ `override`, `prod`): จัดการ Services ต่างๆ
