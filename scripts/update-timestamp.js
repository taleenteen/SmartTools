// scripts/update-timestamp.js
// หน้าที่: สแกน data.js เพื่ออัปเดต metadata ระหว่าง __META_START__ / __META_END__
//        เป็นเวลา UTC ปัจจุบัน + เวอร์ชันลำดับเพิ่มขึ้นอัตโนมัติของวันนั้น
// วิธีใช้: node scripts/update-timestamp.js
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data.js');

if (!fs.existsSync(DATA_FILE)) {
    console.error('❌ ไม่พบไฟล์ data.js:', DATA_FILE);
    process.exit(1);
}

let content = fs.readFileSync(DATA_FILE, 'utf8');

const now = new Date();
const isoTime = now.toISOString();          // 2026-05-08T10:23:45.678Z
const dateStr = isoTime.slice(0, 10);       // 2026-05-08

// หมายเลขเวอร์ชัน: YYYY-MM-DD-NNN อัปเดตหลายครั้งในวันเดียวกันจะเพิ่มลำดับอัตโนมัติ
const versionRegex = /version:\s*'(\d{4}-\d{2}-\d{2})-(\d+)'/;
const match = content.match(versionRegex);
let seq = 1;
if (match && match[1] === dateStr) {
    seq = parseInt(match[2], 10) + 1;
}
const newVersion = `${dateStr}-${String(seq).padStart(3, '0')}`;

const newMetaBlock =
`/* __META_START__ */
window.APP_DATA_META = {
    version:   '${newVersion}',
    updatedAt: '${isoTime}',
    source:    'github'
};
/* __META_END__ */`;

const metaRegex = /\/\* __META_START__ \*\/[\s\S]*?\/\* __META_END__ \*\//;

if (!metaRegex.test(content)) {
    console.error('❌ ไม่พบแท็ก __META_START__ / __META_END__ ใน data.js');
    console.error('   โปรดตรวจสอบว่าด้านบนของ data.js มีแท็กคอมเมนต์ทั้งสองนี้อยู่');
    process.exit(1);
}

const newContent = content.replace(metaRegex, newMetaBlock);

// หากไม่มีการเปลี่ยนแปลงใดๆ จะไม่เขียนไฟล์ซ้ำ (เพื่อหลีกเลี่ยง mtime เปลี่ยนโดยไม่จำเป็น)
if (newContent === content) {
    console.log('ℹ️  metadata ของ data.js เป็นปัจจุบันแล้ว ไม่ต้องอัปเดต');
    process.exit(0);
}

fs.writeFileSync(DATA_FILE, newContent, 'utf8');
console.log(`✅ อัปเดต metadata ของ data.js เรียบร้อยแล้ว`);
console.log(`   version:   ${newVersion}`);
console.log(`   updatedAt: ${isoTime}`);