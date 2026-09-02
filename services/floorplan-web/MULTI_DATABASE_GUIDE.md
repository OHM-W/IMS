# 📖 คู่มือการเพิ่มและเชื่อมต่อ Database ใหม่ในระบบ IMS Floorplan Digital Twin

> **เอกสารคู่มือฉบับสมบูรณ์:** สำหรับวิศวกรและผู้ดูแลระบบในการเพิ่มฐานข้อมูล (Multi-Database Integration) ของแต่ละกระบวนการผลิตเข้าสู่ผังโรงงานดิจิทัล 2D Real-time

---

## 🏗️ 1. สถาปัตยกรรมระบบ (System Architecture)

ระบบถูกออกแบบด้วยสถาปัตยกรรม **Multi-Database Connection Pooling**:
```
┌────────────────────────────────────────────────────────┐
│                   ผังโรงงาน 1F (React UI)               │
└───────────────────────────▲────────────────────────────┘
                            │ WebSocket (/ws/ldi ทุก 2 วิ)
┌───────────────────────────┴────────────────────────────┐
│          Node.js Backend & Broadcaster (Port 8000)      │
└───────────▲───────────────────▲──────────────────▲─────┘
            │                   │                  │
    [ multiDb Pool 1 ]  [ multiDb Pool 2 ] [ multiDb Pool 3 ]
            │                   │                  │
   [ TimescaleDB (Laser) ] [ mydb (Drilling) ] [ oxide_db (Chem) ]
```

- **`databases.json`:** ไฟล์บันทึก IP / Port / User / Password ของทุก Database
- **`multiDb.ts`:** จัดการสร้างและดูแลท่อเชื่อมต่อ (Connection Pool) อัตโนมัติ
- **`broadcaster.ts`:** ยิง Query ดึงสถานะเครื่องจักรจากทุกก้อนพร้อมกัน แล้วรวมส่งขึ้นหน้าจอ

---

## 🚀 2. ขั้นตอนการเพิ่ม Database ใหม่ (Step-by-Step)

การเพิ่ม Database ตัวใหม่มีเพียง **4 ขั้นตอนหลัก** ดังนี้:

---

### 📍 ขั้นตอนที่ 1: เพิ่มข้อมูลการเชื่อมต่อใน `databases.json`

**ไฟล์:** [`c:\IMS\services\floorplan-web\backend\data\databases.json`](file:///c:/IMS/services/floorplan-web/backend/data/databases.json)

เปิดไฟล์ด้วย Notepad หรือ VS Code แล้วเพิ่มบล็อก Database ตัวใหม่เข้าไป:

```json
{
  "drill_db": {
    "type": "postgres",
    "host": "127.0.0.1",
    "port": 5433,
    "database": "mydb",
    "user": "postgres",
    "password": "your_password"
  },
  "chem_db": {
    "type": "postgres",
    "host": "192.168.1.60",
    "port": 5432,
    "database": "oxide_db",
    "user": "postgres",
    "password": "your_password"
  }
}
```

#### 💡 คำอธิบายฟิลด์:
| ชื่อฟิลด์ | ความหมาย | ข้อแนะนำ |
| :--- | :--- | :--- |
| **Key Name** | ชื่อเรียก Database (เช่น `"chem_db"`) | ตั้งชื่อภาษาอังกฤษตัวพิมพ์เล็ก ห้ามมีเว้นวรรค |
| **`type`** | ชนิดของ Database | `"postgres"`, `"timescaledb"`, `"mysql"`, `"mssql"` |
| **`host`** | IP Address ของเครื่อง Database | ถ้าเป็น Database บนเครื่องตัวเอง ใส่ `"127.0.0.1"` (ระบบจะแปลงเข้า Docker ให้อัตโนมัติ) |
| **`port`** | พอร์ตเชื่อมต่อ | PostgreSQL/Timescale: `5432`, MySQL: `3306`, MS-SQL: `1433` |
| **`database`**| ชื่อฐานข้อมูล | ระบุชื่อ Database ที่ต้องการเข้าไปดึงข้อมูล |
| **`user` / `password`** | ชื่อผู้ใช้และรหัสผ่าน | สิทธิ์ในการ `SELECT` อ่านข้อมูล |

---

### 📍 ขั้นตอนที่ 2: ตรวจสอบโครงสร้างตาราง (Inspect Table Schema)

ก่อนเขียน Query ต้องรู้ว่าใน Database นั้น:
1. **ตารางเก็บข้อมูลชื่ออะไร?** (เช่น `tbl_chemical_log`, `tbl_dr_event`)
2. **คอลัมน์รหัสเครื่องจักรชื่ออะไร?** (เช่น `machine_no`, `equipment_id`)
3. **คอลัมน์สถานะชื่ออะไร?** (เช่น `status`, `event_type`, `is_run`)
4. **คอลัมน์เวลาล่าสุดชื่ออะไร?** (เช่น `event_time`, `recorded_at`)

> [!TIP]
> **วิธีง่ายสุด:** แค่แจ้งชื่อ Database กับ AI Assistant ระบบจะรันคำสั่งสแกนตารางและคอลัมน์ทั้งหมดออกมาให้ใน 5 วินาที!

---

### 📍 ขั้นตอนที่ 3: เพิ่มโค้ดใน `broadcaster.ts`

**ไฟล์:** [`c:\IMS\services\floorplan-web\backend\src\broadcaster.ts`](file:///c:/IMS/services/floorplan-web/backend/src/broadcaster.ts)

เปิดไฟล์แล้วเพิ่มโค้ด **2 จุด**:

#### 🔹 จุดที่ 3.1: เขียนคำสั่ง SQL Query (วางต่อท้าย SQL เดิม ด้านบนของไฟล์)

```typescript
const CHEM_DB_SQL = `
SELECT DISTINCT ON (machine_id)
  machine_id AS eqp_id,
  CASE
    WHEN is_running = true THEN 1       -- 1 = RUN (สีเขียว)
    WHEN is_alarm = true THEN 3         -- 3 = ALARM (สีแดงกะพริบ)
    ELSE 2                              -- 2 = IDLE (สีส้ม)
  END AS status,
  temp AS temperature,                  -- อุณหภูมิ (ใส่ NULL::NUMERIC ถ้าไม่มี)
  hum AS humidity,                      -- ความชื้น (ใส่ NULL::NUMERIC ถ้าไม่มี)
  NULL::NUMERIC AS resist_dosage,
  NULL::NUMERIC AS scan_speed,
  NULL::NUMERIC AS air_vacuum,
  NULL::NUMERIC AS thickness,
  current_count AS board_no,            -- ยอดผลิตปัจจุบัน
  target_count AS total_board,          -- ยอดผลิตเป้าหมาย
  NULL::NUMERIC AS total_time,
  lot_no AS mo,                         -- หมายเลข Lot / MO
  part_no AS fpn,                       -- Part Number
  recipe_name AS layer_name,            -- ข้อความสถานะ / Recipe
  recorded_at AS last_seen              -- เวลาล่าสุด
FROM public.tbl_chemical_log
ORDER BY machine_id, recorded_at DESC;
`;
```

#### 🔹 จุดที่ 3.2: สั่งให้ Backend ไปรัน Query (ในฟังก์ชัน `fetchTelemetry`)

เลื่อนลงมาที่ฟังก์ชัน `fetchTelemetry()` แล้ววางบล็อกนี้ก่อนบรรทัด `return allMachines;`:

```typescript
    // 3. Fetch Chemical Database if registered (chem_db)
    const chemPool = multiDb.getPool('chem_db');
    if (chemPool) {
      try {
        const chemRes = await chemPool.query(CHEM_DB_SQL);
        allMachines.push(...chemRes.rows.map(this.formatRow));
      } catch (err: any) {
        console.warn('[floorplan.broadcaster] chem_db query failed:', err.message);
      }
    }
```

---

### 📍 ขั้นตอนที่ 4: สั่ง Restart และตรวจสอบผลลัพธ์ (Deploy & Verify)

1. เปิด Terminal ที่โฟลเดอร์โปรเจกต์ `c:\IMS` แล้วสั่งรีสตาร์ท:
   ```bash
   docker compose restart floorplan-web
   ```

2. **ตรวจสอบการดึงข้อมูลผ่าน Browser:**
   เปิดลิงก์: **`http://localhost:8085/api/snapshot`**
   - จะต้องเห็นรายการเครื่องจักรจาก Database ใหม่โผล่ขึ้นมาใน JSON

3. **ตรวจสอบบนหน้าจอผังโรงงาน:**
   เปิดเว็บ **`http://localhost:8085`** (กด `Ctrl + Shift + R`)
   - กล่องเครื่องจักรของ Database นั้นจะเปลี่ยนเป็น **ไฟสีเขียว `RUN`** หรือ **ไฟสีส้ม `IDLE`** ทันทีครับ!

---

## 🎨 3. รหัสสถานะและสีมาตรฐาน SCADA (Status Codes)

เวลาเขียน `CASE WHEN` ใน SQL ให้แมปตัวเลขสถานะตามมาตรฐาน ISA-101 ดังนี้:

| ค่าตัวเลข | สถานะ | สีบนหน้าจอ | ความหมาย |
| :---: | :--- | :--- | :--- |
| **`1`** | **RUN** | 🟢 เขียวนีออน (`#00FF87`) | เครื่องจักรเปิดใช้งานและกำลังผลิตงานปกติ |
| **`2`** | **IDLE** | 🟠 ส้ม/เหลือง (`#FFB800`) | เครื่องเปิดอยู่แต่สแตนด์บาย / รอโหลดงาน |
| **`3`** | **ALARM** | 🔴 แดงกะพริบ (`#FF003C`) | เครื่องมี Error หรือเกิด Alarm วิกฤต |
| **`4`** | **LOTO / PM**| 🔵 ฟ้านีออน (`#00F2FE`) | ล็อคซ่อมบำรุง / Initial / Setup |
| **`0`** | **OFF** | ⚫ เทาเข้ม (`#64748B`) | เครื่องดับ / ขาดการส่งข้อมูลเกิน 15 นาที |
| **`5`** | **UNDEFINE**| ⚪ ขอบประเทา (`#ECEFF1`) | เครื่องที่ไม่มีข้อมูลใน Database |

---

## 🛠️ 4. การแก้ไขปัญหาที่พบบ่อย (Troubleshooting)

### ❓ ปัญหาที่ 1: เพิ่มใน `databases.json` แล้วแต่ต่อไม่ติด
- **สาเหตุ:** ถ้าเป็น Database บนเครื่องตัวเอง (Windows) แล้วใส่ `127.0.0.1` 
- **วิธีแก้:** ระบบจะแปลงเป็น `host.docker.internal` ให้อัตโนมัติ แต่ต้องเช็คว่า Firewall ของ Windows ไม่ได้บล็อกพอร์ตนั้นไว้

### ❓ ปัญหาที่ 2: ข้อมูลใน DB มี แต่หน้าจอขึ้นเป็นสีเทา (OFF)
- **สาเหตุ:** เวลาในคอลัมน์ `last_seen` เก่าเกิน 15 นาที
- **วิธีแก้:** เช็คเวลาของระบบ หรือเมื่อมีข้อมูลสดใหม่ (Real-time) บันทึกเข้ามา เครื่องจะกลับมาเป็นสีเขียว `RUN` ทันที

### ❓ ปัญหาที่ 3: เครื่องไม่จับคู่กับกล่องบนผังโรงงาน
- **วิธีแก้:** ตรวจสอบว่าชื่อในคอลัมน์ `eqp_id` ตรงกับชื่อกล่องบนผัง (เช่น `054` หรือ `DRL-054`) หรือเข้าไปที่หน้าเว็บเปิด `🛠️ EDIT MODE` แล้วพิมพ์ชื่อให้ตรงในช่อง **`TELEMETRY ID:`** ได้ทันทีครับ
