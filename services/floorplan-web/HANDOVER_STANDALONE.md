# คู่มือการส่งมอบและการใช้งานแบบ Standalone (IMS Floorplan-Web)

คู่มือนี้สำหรับกรณีส่งมอบเฉพาะโมดูล **Floorplan-Web** ไปรันแยกบน Server ปลายทาง โดยไม่ต้องยกโฟลเดอร์ root ของโปรเจกต์ IMS ไปทั้งหมด

---

## 1. สิ่งที่มีอยู่ในโฟลเดอร์นี้
* `frontend/`: React 18 SPA (Vite + TypeScript + TailwindCSS + Panzoom)
* `backend/`: Node.js Express + WebSocket Broadcaster
* `backend/data/`:
  * `custom_fleet.json`: ผังตำแหน่งเครื่องจักรและข้อมูลการจับคู่
  * `databases.json`: คอนฟิกเชื่อมต่อฐานข้อมูลภายนอก (Multi-DB)
  * `queries/`: ไฟล์ SQL คิวรี telemetry
* `Dockerfile`: Multi-stage build (React + Node.js + Nginx + Supervisord)
* `docker-compose.yaml`: คอนฟิกรัน standalone จบในคำสั่งเดียว
* `.env.example`: ตัวอย่างไฟล์ตัวแปรแวดล้อม

---

## 2. ขั้นตอนการติดตั้งและรัน (ด้วย Docker)

1. **คัดลอกโฟลเดอร์ `floorplan-web/`** ไปวางบน Server ปลายทาง (ที่ติดตั้ง Docker & Docker Compose)
2. **สร้างไฟล์ `.env`**:
   ```bash
   cp .env.example .env
   ```
   จากนั้นแก้ไขค่าใน `.env`:
   * `PGHOST`: ใส่ IP ของ Database ปลายทาง (หากอยู่เครื่องเดียวกับ Host ให้ใช้ `host.docker.internal`)
   * `PGPASSWORD`: ใส่รหัสผ่านของฐานข้อมูล
   * `PORT`: พอร์ตหน้าเว็บ (ค่าเริ่มต้น `8085`)
3. **สั่ง Start Service**:
   ```bash
   docker compose up -d --build
   ```
4. **ตรวจสอบสถานะ**:
   ```bash
   docker compose ps
   # สถานะต้องขึ้น healthy
   ```
5. **เข้าใช้งาน**:
   * หน้าเว็บ: `http://<SERVER_IP>:8085`
   * ตรวจสอบ API: `http://<SERVER_IP>:8085/api/health`

---

## 3. Checklist การทดสอบส่งมอบหน้างาน

1. **TopBar Live Status**: มุมขวาบนขึ้นสถานะสีเขียว `● LIVE`
2. **Floorplan Pan & Zoom**: เมาส์ลากผัง ซูมเข้า-ออก และปุ่ม Reset มุมกล้องทำงานปกติ
3. **Process Filter**: กดปุ่มเลือกกระบวนการ (Drilling, Cutting, Oxide ฯลฯ) กล้องซูมไปยังโซนถูกต้อง
4. **Machine Detail Popup**:
   * คลิกเครื่องเจาะ (`DRL-...`) -> แสดง NC Program, Hits, Tool
   * คลิกเครื่องเลเซอร์ (`LDI-...`) -> แสดง Lot Progress, Chamber Optics
   * คลิกเครื่องทั่วไป (`CUT-...`, `BWN...`) -> แสดง Profile สเปกเครื่องปกติ (ไม่หลุดเป็นเลเซอร์)
5. **Operator Layout & Remap**:
   * สามารถแก้ไขชื่อเครื่องจักรหรือจับคู่ Telemetry ID แล้วกดบันทึกได้
   * เข้าโหมดจัดผังด้วย `?dev=true` เพื่อลากย้ายตำแหน่งเครื่องจักรได้
