/* ============================================================
   data.js — ข้อมูล Bookmarks
   แก้ไขไฟล์นี้เพื่อเพิ่ม ลบ หรือแก้ไขเนื้อหา โดยไม่ต้องแก้โค้ดหน้าเว็บ

   type ของการ์ด:
     'simple'         — คลิกทั้งการ์ดเพื่อเปิด url
     'desc-clickable' — การ์ดเปิด url ข้อความคำอธิบายเปิด descUrl
     'expandable'     — มีเมนูย่อยให้กางออก (subCards)
                        คำอธิบายใช้ desc (ข้อความล้วน) หรือ descClickable + descUrl (ลิงก์ที่คลิกได้)

   การ์ดย่อย:
     แบบ 2 บรรทัด  { icon, title, desc, url }
     แบบกะทัดรัด   { icon, content, url }
     ไอคอนรูปภาพใช้ iconImg แทน icon; ลิงก์ภายในเครื่องเพิ่ม isLocal: true

   วิธีเขียนไอคอน icon 3 รูปแบบ:
     1. Emoji / ข้อความ
        icon: '🔥'
        icon: 'AI'

     2. ลิงก์รูปภาพ (ใช้ฟิลด์ iconImg แทน icon)
        iconImg: 'https://example.com/logo.png'

     3. SVG แบบอินไลน์ (ใช้ฟิลด์ icon ค่าเป็นสตริง SVG บรรทัดเดียว)
        แบบบรรทัดเดียว (เครื่องหมายคำพูดทั่วไป):
          icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>'

   ข้อควรระวังสำหรับไอคอน SVG:
     - SVG ต้องเป็นสตริงบรรทัดเดียว การเขียนหลายบรรทัดอาจทำให้ JS พาร์สล้มเหลว
     - ต้องระบุ xmlns="http://www.w3.org/2000/svg" และ viewBox
     - หลีกเลี่ยงการใช้ id ซ้ำกัน เช่น <linearGradient>
     - ใน CSS .link-icon-svg svg ควรกำหนด width/height: 100%
     - แนะนำให้ใช้ viewBox "0 0 128 128" เพื่อความสม่ำเสมอ

   ฟิลด์ Section:
     builtin: true=ในตัวลบไม่ได้ / false=กำหนดเองลบได้
     key:     ตัวระบุเฉพาะ (ค่าในตัวล็อกไว้)
     kind:    'card' | 'email' | 'contact'
     dynamic: เปิดใช้งานการกาง/พับการ์ดหรือไม่
     visible: ผู้ใช้สามารถปิดการแสดงผลได้
     label:   ชื่อที่แสดง | defaultLabel: สำหรับกู้คืนค่าเริ่มต้น
   ============================================================ */

/* ============================================================
   ⚠️ บล็อก __META__ ด้านล่างดูแลอัตโนมัติโดย scripts/update-timestamp.js
      โปรดอย่าแก้ไขด้วยตนเอง จะถูกเขียนทับในการรันสคริปต์ครั้งถัดไป
   ============================================================ */

/* __META_START__ */
window.APP_DATA_META = {
    version:   '2026-08-05-007',
    updatedAt: '2026-08-05T06:38:20.805Z',
    source:    'github'
};
/* __META_END__ */

var sections = [
    // ==================== ☁️ ไดรฟ์ออนไลน์ ====================
    {
        builtin: true,
        key: 'usbDriveData',
        kind: 'card',
        dynamic: false,
        label: '☁️ ไดรฟ์ออนไลน์',
        visible: true,
        cards: [
            {
                icon: '👩🏻‍🏫',
                id: 'lty-xinhua',
                title: 'lty ไดรฟ์ออนไลน์ (Xinhua)',
                url: 'https://www.jianguoyun.com/p/DTPAg6sQptHYCBjA6_YFIAA',
                type: 'desc-clickable',
                descClickable: 'to2.top/lty',
                descUrl: 'http://mrr.cc/lty'
            },
            {
                id: 'lty-longan',
                icon: '👩🏻‍⚖️',
                title: 'lty ไดรฟ์ออนไลน์ (Longan)',
                url: 'https://www.jianguoyun.com/p/DQ0EyaEQptHYCBj9ivkFIAA',
                type: 'desc-clickable',
                descClickable: 'to2.top/la',
                descUrl: 'http://mrr.cc/la'
            },
            {
                icon: '💾',
                id: 'zz',
                title: 'zz ไดรฟ์ออนไลน์',
                url: 'https://www.jianguoyun.com/p/DRNDENoQyu2zDBjYlZ0GIAA',
                type: 'expandable',
                descClickable: 'to2.top/u',
                descUrl: 'http://to2.top/u',
                subCards: [
                    {
                        icon: '📤',
                        title: 'อัปโหลดและแชร์ชั่วคราว',
                        desc: 'f66.fun/fun mrr.cc/cc (รหัสผ่าน: zz1001)',
                        url: 'https://www.jianguoyun.com/p/DemLEOwQpYHpBRiwtscFIAA'
                    },
                    {
                        icon: '📥',
                        title: 'อัปโหลดเข้ารหัสชั่วคราว',
                        desc: 'n29.net/net (รหัสผ่าน: ZZ67 ชั่วคราว)',
                        url: 'https://www.jianguoyun.com/p/Das4Xf8QpYHpBRj68J8GIAA'
                    },
                    {
                        icon: '📁',
                        title: 'ไดรฟ์ออนไลน์สำรอง',
                        desc: 'mrr.cc/u หรือ n29.net/u',
                        url: 'https://www.jianguoyun.com/p/DRNDENoQyu2zDBjYlZ0GIAA'
                    }
                ]
            },
            {
                id: 'oplist',
                iconImg: 'https://o.n29.net/p/00%E5%AE%B6%E5%BA%AD%E4%BA%91%E7%A1%AC%E7%9B%9800/%E5%AD%98%E5%82%A8/A1/Share/pubphoto/catcloud.png?sign=vwyhzmBGhTCy_XAWy9wsDkPnuzk0JIZ3ddGOcQFGCPU=:0',
                title: 'Oplist คลาวด์ไดรฟ์',
                url: 'https://o.n29.net/',
                type: 'expandable',
                descClickable: 'n29.net',
                descUrl: 'https://n29.net/',
                subCards: [
                    {
                        iconImg: 'https://o.n29.net/p/00%E5%AE%B6%E5%BA%AD%E4%BA%91%E7%A1%AC%E7%9B%9800/%E5%AD%98%E5%82%A8/A1/Share/pubphoto/1f408_1.png?sign=lrzrBwcoutlJ87ypmRrNxvKTcZHUKoWiOqb1432x4to=:0',
                        title: 'คลาวด์ไดรฟ์',
                        desc: 'w.n29.net',
                        url: 'https://992929.xyz/'
                    },
                    {
                        icon: '💽',
                        title: 'ที่อยู่สำรอง',
                        desc: 'n29.net/29',
                        url: 'http://92999.top:2999/'
                    },
                    {
                        icon: '🌳',
                        title: 'Yongshuo E-Disk',
                        desc: 'cccpan.com',
                        url: 'http://yumumao.ysepan.com/'
                    },
                    {
                        icon: '🖼',
                        title: 'โฮสต์ฝากรูปภาพ',
                        desc: 's.ee',
                        url: 'https://s.ee/'
                    }
                ]
            }
        ]
    },
    // ==================== 📚 สื่อการสอน ====================
    {
        builtin: true,
        key: 'teachingData',
        kind: 'card',
        dynamic: false,
        label: '📚 สื่อการสอน',
        visible: true,
        cards: [
            {
                id: 'chaoxing',
                icon: '👨‍⚕',
                title: 'แพลตฟอร์ม Chaoxing',
                url: 'https://gdpu.fanya.chaoxing.com/',
                type: 'expandable',
                descClickable: 'Guangyao @ Chaoxing',
                descUrl: 'https://gdpu.fanya.chaoxing.com/',
                subCards: [
                    {
                        icon: '🩺',
                        title: 'Chaoxing - สรีรวิทยา 1',
                        desc: 'f66.fun/mooc1',
                        url: 'https://mooc1.chaoxing.com/mooc-ans/course/214155769.html'
                    },
                    {
                        icon: '🧫',
                        title: 'Chaoxing - สรีรวิทยา 2',
                        desc: 'f66.fun/mooc',
                        url: 'https://mooc1-2.chaoxing.com/mooc-ans/course/214155769.html'
                    },
                    {
                        icon: '🏛️',
                        title: 'พอร์ทัลรวม',
                        desc: 'portal.gdpu.edu.cn/#/index',
                        url: 'https://portal.gdpu.edu.cn/#/index'
                    },
                    {
                        icon: '🌐',
                        title: 'เข้าสู่ระบบเครือข่ายมหาวิทยาลัย',
                        desc: '172.21.199.252',
                        url: 'http://172.21.199.252/'
                    }
                ]
            },
            {
                id: 'ppt',
                icon: '👨🏻‍🏫',
                title: 'สไลด์ PPT สรีรวิทยา',
                url: 'https://www.jianguoyun.com/p/DczPqnIQyu2zDBi3oYMGIAA',
                type: 'expandable',
                descClickable: 'f66.fun/slx',
                descUrl: 'http://f66.fun/slx',
                subCards: [
                    {
                        icon: '👨🏻‍🔬',
                        title: 'วิดีโอการทดลอง Guangyao',
                        desc: 'f66.fun/ve',
                        url: 'https://www.jianguoyun.com/p/DRHT5LcQzLmCCRj5x6kF'
                    },
                    {
                        icon: '🐰',
                        title: 'วิดีโอการทดลองอื่นๆ',
                        desc: 'วิดีโอสาธิตอื่นๆ',
                        url: 'https://www.jianguoyun.com/p/DYsBRugQzLmCCRjd74AG'
                    },
                    {
                        icon: '🩺',
                        title: 'โครงร่างความรู้สรีรวิทยา',
                        desc: 'ความรู้ทางคลินิกที่เกี่ยวข้อง',
                        url: 'tools/slxzsd.html?from=index',
                        isLocal: true
                    },
                    {
                        icon: '🚑',
                        title: 'ความรู้การปฐมพยาบาล',
                        desc: 'f66.fun/aid',
                        url: 'https://www.jianguoyun.com/p/DdCoU9cQzLmCCRia2bgFIAA'
                    }
                ]
            },
            {
                id: 'medical-tools',
                icon: '🏥',
                title: 'เครื่องมือการแพทย์ออนไลน์',
                url: 'https://www.medsci.cn/medsci-tools',
                type: 'expandable',
                desc: 'คำนวณ / ตาราง / สถิติ',
                subCards: [
                    {
                        icon: '💉',
                        title: 'เครื่องคิดเลขการแพทย์ MedSci',
                        desc: 'm.medsci.cn/scale/index.do',
                        url: 'https://m.medsci.cn/scale/index.do'
                    },
                    {
                        icon: '💊',
                        title: 'ผู้ช่วยการใช้ยา',
                        desc: 'drugs.dxy.cn',
                        url: 'https://drugs.dxy.cn/'
                    },
                    {
                        icon: '📐',
                        title: 'การคำนวณทางการแพทย์ Medlive',
                        desc: 'cals.medlive.cn',
                        url: 'https://cals.medlive.cn/'
                    },
                    {
                        icon: '🌏',
                        title: 'สถิติการแพทย์ Mstata',
                        desc: 'mstata.com/',
                        url: 'https://www.mstata.com/'
                    }
                ]
            },
            {
                id: 'calc-tools',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect x="20" y="10" width="88" height="108" rx="16" fill="#5C6BC0"/><rect x="20" y="10" width="88" height="46" rx="16" fill="#fff" opacity="0.1"/><rect x="32" y="22" width="64" height="30" rx="6" fill="#B2DFDB"/><text x="64" y="45" text-anchor="middle" font-family="Arial" font-weight="900" font-size="22" fill="#004D40">AI</text><path d="M88 25l2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5z" fill="#FFD600"/><circle cx="44" cy="72" r="7" fill="#FFAB91"/><circle cx="64" cy="72" r="7" fill="#FFAB91"/><circle cx="84" cy="72" r="7" fill="#FFE082"/><circle cx="44" cy="96" r="7" fill="#E8EAF6"/><circle cx="64" cy="96" r="7" fill="#E8EAF6"/><circle cx="84" cy="96" r="7" fill="#66BB6A"/></svg>',
                title: 'เครื่องคิดเลขออนไลน์',
                url: 'https://www.geogebra.org/',
                type: 'expandable',
                desc: 'คำนวณออนไลน์',
                subCards: [
                    {
                        icon: '📈',
                        title: 'เครื่องคิดเลขกราฟิก Desmos',
                        desc: 'desmos.com/calculator',
                        url: 'https://www.desmos.com/calculator?lang=zh-CN'
                    },
                    {
                        icon: '⌨️',
                        title: 'WolframAlpha ปัญญาประดิษฐ์การคำนวณ',
                        desc: 'wolframalpha.com',
                        url: 'https://wolframalpha.com'
                    },
                    {
                        icon: '🔢',
                        title: 'ชุดโปรแกรมคำนวณ GeoGebra',
                        desc: 'geogebra.org/calculator',
                        url: 'https://www.geogebra.org/calculator'
                    }
                ]
            },
            {
                icon: '👨🏻‍🔧',
                id: 'ohthercalc-tools',
                title: 'เครื่องมือออนไลน์',
                url: '/t',
                type: 'expandable',
                desc: 'ยูทิลิตี้ออนไลน์',
                subCards: [
                    {
                        icon: '🧪',
                        title: 'SIMPOP',
                        desc: 'จำลองการทดลองมัธยม',
                        url: 'https://simpop.org/'
                    },
                    {
                        icon: '🧲',
                        title: 'myphysics',
                        desc: 'คลังสื่อการสอนฟิสิกส์',
                        url: 'https://myphysics-lab.com/'
                    },
                    {
                        icon: '🛠️',
                        title: 'YiMuHan',
                        desc: 'รวมเครื่องมือขนาดเล็ก',
                        url: 'https://ol.woobx.cn/'
                    },
                    {
                        icon: '🔄',
                        title: 'แปลงรูปแบบไฟล์',
                        desc: 'แปลงไฟล์ทุกรูปแบบ',
                        url: 'https://www.aconvert.com/cn/'
                    }
                ]
            },
            {
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2FBFE"/><stop offset=".5" stop-color="#EAF8FC"/><stop offset=".5" stop-color="#D8EFF8"/><stop offset="1" stop-color="#CFEAF5"/></linearGradient><linearGradient id="laser" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1E88C8" stop-opacity=".15"/><stop offset=".5" stop-color="#6BE7FF"/><stop offset="1" stop-color="#1E88C8" stop-opacity=".15"/></linearGradient></defs><g fill="none" stroke="#1E88C8" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"><path d="M44 176V104c0-33 27-60 60-60h78"/><path d="M330 44h78c33 0 60 27 60 60v78"/><path d="M468 330v78c0 33-27 60-60 60h-78"/><path d="M182 468h-78c-33 0-60-27-60-60v-78"/></g><rect x="132" y="112" width="248" height="288" rx="44" fill="url(#bg)"/><rect x="132" y="112" width="248" height="288" rx="44" fill="none" stroke="#1E88C8" stroke-width="20"/><rect x="72" y="241" width="368" height="30" rx="15" fill="#1E88C8"/><line x1="72" y1="249" x2="440" y2="249" stroke="url(#laser)" stroke-width="8" stroke-linecap="round"/><rect x="192" y="170" width="128" height="8" rx="4" fill="#1E88C8" opacity=".18"/><rect x="192" y="334" width="128" height="8" rx="4" fill="#1E88C8" opacity=".15"/></svg>',
                id: 'card_ms3cwpc1_2duf',
                title: 'ScanDex',
                url: 'https://scandex.n29.net',
                type: 'expandable',
                desc: 'จัดการภาพสแกน',
                subCards: [
                    {
                        icon: '📇',
                        title: 'ImgToDoc',
                        desc: 'บริการ ImgToDoc (เครือข่ายภายในเท่านั้น)',
                        url: 'http://192.168.2.166.:8787'
                    },
                    {
                        icon: '📓',
                        title: 'สมุดบันทึกข้อผิดพลาด AI',
                        desc: 'wn.n29.net',
                        url: 'https://wn.n29.net/'
                    }
                ]
            }
        ]
    },
    // ==================== 🖥️ แหล่งข้อมูลออนไลน์ ====================
    {
        builtin: true,
        key: 'onlineAIData',
        kind: 'card',
        dynamic: true,
        label: '🖥️ แหล่งข้อมูลออนไลน์',
        visible: true,
        cards: [
            {
                icon: '🧞',
                id: 'qwen',
                title: 'Qwen',
                url: 'https://chat.qwen.ai/',
                type: 'expandable',
                desc: 'รวม Qwen และอื่นๆ',
                subCards: [
                    {
                        icon: '🤿',
                        title: 'DeepSeek',
                        desc: 'DeepSeek ผู้ช่วย AI',
                        url: 'https://www.deepseek.com/'
                    },
                    {
                        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#897EFF"/><stop offset="100%" stop-color="#5A42F2"/></linearGradient></defs><rect x="1" y="1" width="126" height="126" rx="28" fill="url(#g)" stroke="#FFF" stroke-width="1"/><g transform="translate(64 66) rotate(-22) scale(1.28)"><path fill="#FCFCFF" d="M-29-18L-40-37C-43-42-35-47-28-43L-12-33C-5-35 5-35 12-33L28-43C35-47 43-42 40-37L29-18C36-12 39-2 39 10C39 29 24 42 0 42C-24 42-39 29-39 10C-39-2-36-12-29-18Z"/><rect x="-16" y="-2" width="7" height="17" rx="3.5" fill="#6B58FF" transform="rotate(-12 -12 6)"/><rect x="9" y="-2" width="7" height="17" rx="3.5" fill="#6B58FF" transform="rotate(-12 13 6)"/></g></svg>',
                        title: 'WorkBuddy',
                        desc: 'ผู้ช่วย AI ของ Tencent',
                        url: 'https://www.codebuddy.cn/home/'
                    },
                    {
                        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect x="1" y="1" width="126" height="126" rx="28" fill="#000" stroke="#fff" stroke-width="1"/><text x="69.5" y="93" text-anchor="middle" font-family="Inter,\'SF Pro Display\',\'Helvetica Neue\',Helvetica,Arial,sans-serif" font-size="92" font-weight="500" transform="translate(-5.8 0) scale(0.92 1)" fill="#fff">K</text><circle cx="92" cy="34" r="4.2" fill="#2EA8FF"/></svg>',
                        title: 'kimi',
                        desc: 'Kimi AI',
                        url: 'https://www.kimi.com/',
                        comment: '[แพลตฟอร์ม KIMI API](https://platform.kimi.com/)'
                    },
                    {
                        icon: '💁‍',
                        title: 'Doubao',
                        desc: 'ผู้ช่วย AI ของ ByteDance',
                        url: 'https://www.doubao.com/'
                    }
                ]
            },
            {
                id: 'poe',
                icon: '🧙‍',
                title: 'POE',
                desc: 'รวมผู้ช่วย AI',
                url: 'https://poe.com/',
                type: 'expandable',
                subCards: [
                    {
                        icon: '✦',
                        title: 'Gemini',
                        desc: 'AI จาก Google',
                        url: 'https://gemini.google.com/'
                    },
                    {
                        icon: '💬',
                        title: 'ChatGPT',
                        desc: 'แชทบอทของ OpenAI',
                        url: 'https://chat.openai.com/'
                    },
                    {
                        icon: '🦊',
                        title: 'Grok',
                        desc: 'ผู้ช่วย AI จาก xAI',
                        url: 'https://grok.com/'
                    },
                    {
                        icon: '🎆',
                        title: 'Claude',
                        desc: 'เก่งด้านการเขียนโค้ด',
                        url: 'https://www.anthropic.com/claude'
                    }
                ]
            },
            {
                id: 'mitasearch',
                icon: '🔎',
                title: 'Mita Search',
                desc: 'เครื่องมือ AI ประยุกต์',
                url: 'https://metaso.cn/',
                type: 'expandable',
                subCards: [
                    {
                        icon: '🔬',
                        title: 'Nami Search',
                        desc: 'เครื่องมือค้นหา AI',
                        url: 'https://www.n.cn/'
                    },
                    {
                        icon: '✵',
                        title: 'Perplexity',
                        desc: 'ค้นหาด้วย AI',
                        url: 'https://www.perplexity.ai/'
                    },
                    {
                        icon: '👁️‍🗨️',
                        title: 'BibiGPT',
                        desc: 'สรุปเสียงและวิดีโอด้วย AI',
                        url: 'https://bibigpt.co/'
                    },
                    {
                        icon: '🐈',
                        title: 'RuoYu',
                        desc: 'แปลเอกสาร',
                        url: 'https://ruoyu.dingyu.me/'
                    }
                ]
            },
            {
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1368 1368"><path fill="#F6821F" d="M0 932c0-132 93-231 201-241-22-100 54-181 137-181 37 0 67 9 92 28 47-132 170-219 304-219 153 0 278 103 321 258-27 75-55 150-82 225-24 66-82 129-179 159H9c-5 0-9-4-9-9v-20z"/><path fill="#FDBA3D" d="M1077 589c149 0 291 109 291 267 0 29-5 56-13 81H969c-5 0-8-5-6-10l72-197c16-45 22-89 42-141z"/><path fill="#fff" d="M379 771h487c88 0 146-51 173-127l20-56c2-6 9-8 14-4 8 6 23 7 45 6-24 71-49 142-72 213-10 31 8 62 40 66l143 16c6 1 10 5 10 11s-5 10-11 10l-141 8c-39 2-73 26-88 63l-77 184c-3 7-14 5-12-3l54-236c8-35-19-69-55-69H379c-6 0-11-5-11-11v-6c0-6 5-11 11-11z" transform="translate(0 25) scale(1 .9)"/></svg>',
                id: 'cloudflare',
                title: 'Cloudflare',
                url: 'https://www.cloudflare.com/',
                type: 'simple',
                desc: 'Cloudflare'
            },
            {
                id: 'freedidi',
                icon: '👫🏻',
                title: 'Zero Degree Blog',
                desc: 'บล็อก Zero Degree',
                url: 'https://www.freedidi.com/',
                type: 'simple'
            },
            {
                id: 'vercel',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><circle cx="64" cy="64" r="56" fill="#333333" stroke="#FFFFFF" stroke-width="4"/><polygon points="64,33 91,80 37,80" fill="#FFFFFF"/></svg>',
                title: 'Vercel',
                desc: 'vercel',
                url: 'https://vercel.com/',
                type: 'simple'
            },
            {
                id: 'zeabur',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><line x1="84" y1="45" x2="22" y2="83" stroke="#FFFFFF" stroke-width="16" stroke-linecap="butt"/><polygon points="18,26 94,26 88,50 12,50" fill="#000000" stroke="#FFFFFF" stroke-width="4"/><polygon points="18,78 94,78 88,102 12,102" fill="#000000" stroke="#FFFFFF" stroke-width="4"/><polygon points="18,26 74,26 68,50 12,50" fill="#6B3FA0"/><polygon points="74,26 94,26 88,50 68,50" fill="#333333"/><line x1="84" y1="45" x2="22" y2="83" stroke="#333333" stroke-width="12" stroke-linecap="butt"/><polygon points="38,78 94,78 88,102 32,102" fill="#E8632B"/><polygon points="18,78 38,78 32,102 12,102" fill="#333333"/></svg>',
                title: 'Zeabur',
                desc: 'zeabur',
                url: 'https://zeabur.com/',
                type: 'simple'
            },
            {
                id: 'upstash',
                icon: '🌀',
                title: 'Upstash',
                desc: 'upstash',
                url: 'https://upstash.com/',
                type: 'simple'
            },
            {
                id: 'AddressGeneratorFe',
                icon: '🗺️',
                title: 'AddressGenerator',
                desc: 'เครื่องมือสุ่มที่อยู่',
                url: 'https://addr.f66.fun/',
                type: 'simple'
            }
        ]
    },
    // ==================== 🎬 วิดีโอรวม ====================
    {
        builtin: true,
        key: 'videoData',
        kind: 'card',
        dynamic: true,
        label: '🎬 วิดีโอรวม',
        visible: true,
        cards: [
            {
                id: 'lunatv',
                icon: '🌗',
                title: 'LunaTV-Zb',
                desc: 'แพลตฟอร์มภาพยนตร์และซีรีส์รวม',
                url: 'https://m.f66.fun/',
                type: 'expandable',
                subCards: [
                    {
                        icon: '🧝🏽‍',
                        title: 'KatTV-V',
                        desc: 'k.f66.fun',
                        url: 'https://k.f66.fun/'
                    },
                    {
                        icon: '🌜️',
                        title: 'MoonTV²-V',
                        desc: 'm2.f66.fun',
                        url: 'https://m2.f66.fun/'
                    },
                    {
                        icon: '🌈',
                        title: 'xiaoya',
                        desc: 'xy.f66.fun',
                        url: 'https://xy.f66.fun/'
                    },
                    {
                        icon: '🔍',
                        title: 'pansou',
                        desc: 'ค้นหาบนคลาวด์ไดรฟ์',
                        url: 'https://pso.992929.xyz/'
                    }
                ]
            },
            {
                id: 'yingshiselin',
                icon: '🌲',
                title: 'Yingshi Senlin',
                desc: 'นำทางแหล่งข้อมูล',
                url: 'https://www.tvtv1.cc/',
                type: 'expandable',
                subCards: [
                    {
                        icon: '🔗',
                        content: 'หน้าประกาศ URL',
                        url: 'https://www.tvtv.cc/'
                    },
                    {
                        icon: '🔗',
                        content: 'www.tvtv2.cc',
                        url: 'https://www.tvtv2.cc/'
                    }
                ]
            },
            {
                icon: '🎥',
                id: 'guanying',
                title: 'Qiwei Viewing',
                url: 'https://www.gmp4.com/',
                type: 'expandable',
                desc: 'รวมภาพยนตร์และซีรีส์',
                subCards: [
                    {
                        icon: '🎬',
                        content: 'ประกาศ URL Qiwei',
                        url: 'https://www.qn63.com'
                    },
                    {
                        icon: '👻',
                        content: 'ประกาศ URL สำหรับรับชม (VPN)',
                        url: 'https://www.offline-mirror.com/'
                    },
                    {
                        icon: '🎭',
                        content: 'gying1(fq)',
                        url: 'https://www.xn--wcv59z.com/'
                    },
                    {
                        icon: '🎪',
                        content: 'gying2(fq)',
                        url: 'https://www.hgeme.com/'
                    }
                ]
            },
            {
                id: 'xiuluoyingshi',
                icon: '🐮',
                title: 'Moovie',
                desc: 'ค้นหาภาพยนตร์และซีรีส์แบบรวมศูนย์',
                url: 'https://moovie.c2v2.com/',
                type: 'simple'
            },
            {
                id: 'maitianyingshi',
                icon: '‍🌾',
                title: 'Maitian Cinema',
                descClickable: 'mtyy.tv (ประกาศ URL)',
                descUrl: 'https://www.mtyy.tv/',
                url: 'https://mtyy5.com/',
                type: 'desc-clickable'
            },
            {
                id: 'changzhanquan',
                icon: '🎨',
                title: 'Changzhang Resources',
                desc: 'ดูภาพยนตร์และซีรีส์ออนไลน์',
                url: 'https://cz01.vip/',
                type: 'simple'
            },
            {
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="#4682B4"/><text x="50" y="93" text-anchor="middle" font-family="Arial Narrow, Helvetica Neue, Arial, sans-serif" font-size="108" font-stretch="condensed" font-weight="700" fill="#fff" transform="scale(.78 1) translate(14 0)">dd</text></svg>',
                id: 'card_mq1d6eo1_l6xh',
                title: 'DiDuan Movie',
                url: 'https://ddys.app/',
                type: 'simple',
                desc: 'คุณภาพสูง คมชัด HD'
            },
            {
                icon: '🍃',
                id: 'seedhub',
                title: 'SeedHub (เว็บดาวน์โหลด)',
                url: 'https://seeduck.cc/',
                type: 'desc-clickable',
                descClickable: 'หน้าประกาศ URL',
                descUrl: 'https://seeduck.cc/zuixin-di-zhi/'
            },
            {
                icon: '🔻',
                id: 'butailing',
                title: 'BuTaiLing (เว็บดาวน์โหลด)',
                url: 'https://www.6bt0.com/',
                type: 'desc-clickable',
                descClickable: 'หน้าประกาศ URL',
                descUrl: 'https://www.butailing.com/'
            },
            {
                icon: '🏰',
                id: 'dianyingtiantang',
                title: 'Dytt8',
                url: 'https://www.dygod.vip/',
                type: 'simple',
                desc: 'ดาวน์โหลดภาพยนตร์คลาสสิก'
            },
            {
                icon: '📺',
                id: 'moovie',
                title: 'Xueluo Movie',
                url: 'https://v.xl01.eu.cc/',
                type: 'simple',
                desc: 'แหล่งข้อมูลหลากหลาย'
            },
            {
                id: '7080wang',
                icon: '📹',
                title: '7080 Net',
                desc: 'แหล่งข้อมูลภาพยนตร์ย้อนยุค',
                url: 'https://7080.wang/',
                type: 'simple'
            },
            {
                icon: '🐻',
                id: 'cilixiong',
                title: 'Cilixiong Magnet',
                url: 'https://www.cilixiong.org/',
                type: 'desc-clickable',
                descClickable: 'cilixiong.cc (สำรอง)',
                descUrl: 'https://www.cilixiong.cc/',
                comment: 'F'
            },
            {
                icon: '🎬',
                id: '4kyingshi',
                title: '4K Movie',
                url: 'https://www.4kvm.tv/',
                type: 'desc-clickable',
                descClickable: 'หน้าประกาศ URL',
                descUrl: 'https://4kvm.site/',
                comment: 'F'
            },
            {
                icon: '🍚',
                id: 'fantaiying',
                title: 'FanTaiYing (นำทาง)',
                url: 'https://www.fantaiying.com/',
                type: 'desc-clickable',
                descClickable: 'URL สำรอง',
                descUrl: 'https://tvboxconf.clbug.com/',
                comment: 'F'
            }
        ]
    },
    // ==================== 📨 อีเมล ====================
    {
        builtin: true,
        key: 'emailData',
        kind: 'email',
        dynamic: false,
        label: '📨 อีเมล',
        visible: true,
        cards: [
            {
                icon: '✉️',
                title: 'อีเมล 1',
                address: 'aabb(AT)cc.cc',
                url: 'http://aabb.cc.cc',
                mailto: 'http://aabb.cc.cc'
            },
            {
                icon: '📪',
                title: 'อีเมล 2',
                address: 'aaabbb(AT)cc.cc',
                url: 'http://aaabbb.cc.cc',
                mailto: 'http://aaabbb.cc.cc'
            },
            {
                icon: '📬',
                title: 'อีเมล 3',
                address: 'abab(AT)cc.cc',
                url: 'http://abab.cc.cc',
                mailto: 'http://abab.cc.cc'
            },
            {
                icon: '📭',
                title: 'อีเมล 4',
                address: 'n(AT)n29.net',
                url: 'https://o.n29.net',
                mailto: 'https://o.n29.net'
            },
            {
                icon: '🌐',
                title: 'อีเมล 5',
                address: 'm(AT)mrr.cc',
                url: 'https://mrr.cc',
                mailto: 'https://mrr.cc'
            }
        ]
    },
    // ==================== 📨 ช่องทางติดต่ออื่นๆ ====================
    {
        builtin: true,
        key: 'contactData',
        kind: 'contact',
        dynamic: false,
        label: '📨 ช่องทางติดต่ออื่นๆ',
        visible: true,
        cards: [
            {
                icon: '🐙',
                title: 'GitHub',
                desc: 'Repositories@GitHub.com',
                url: 'https://github.com/yumumao',
                descUrl: 'https://github.com/yumumao?tab=repositories'
            }
        ]
    },

    // ==================== หมวดหมู่กำหนดเอง (เพิ่ม ลบ แก้ไข ได้ในหน้า Settings) ====================
    // ----- 💟 โปรเจกต์ส่วนตัว -----
    {
        builtin: false,
        key: 'custom_moyq5cad_ezc0r',
        kind: 'card',
        dynamic: true,
        label: '💟 โปรเจกต์ส่วนตัว',
        visible: true,
        encrypted: true,
        enc: {
            v: 1,
            alg: 'AES-GCM-256/PBKDF2-SHA256',
            iter: 300000,
            salt: 'L69VpYy9bsuioLab+07Y2g==',
            iv: 'tVO7r3MIHl1W70TZ',
            data: 'AvazivIfpan0jBCDHYSVzSuFbk5oqRyv/S55NezP2IHBplx1AfNDUKE47RmQeq2n7OL3dgevwaK7lc8pIJevy51Xfp1KtlFPdj0AxBRUfs6V7fBuXDjpBtVU2Eqs3TP8hEE0/5oZy/TwXgA14B3UnB6h6xe9FkSbtC84j+vU5zTQJPVOdTHNBr0Y7NSZxsL9Wx46Xaq4RIDDQeWUJb2NwpcoLWt4+jVvvrnMasxN6yGRyQal/YXgzajyLj/EtYvD1IOkcm6OxjzPtQY6UELSQVunZ8UVtGQPTKoR7Z1qHjjtHxkADwS8KCMdMw/XycneCoZ9U1h++nVd0TJ2AYLQ56+X2N4mx6Rr3AU4HMjEXPcoGlyFVKVgnKq/KD4G/2qmVQkT50ncx0DR13go/EA/Gchngt/zeH54+hIHgA7bI0JsdE4rwpKnduVVfbr+EXUBeJ4F59xiaSbcSJGMzmjEj3KQCrHk3MF40Vc9SlwVw1GEytBZ2Kzpg2ekM/MpOyeWeSoRpsBkpn281KHZTsO3+/U08yDfkXaxvKWT6dOcS9hB2pw4kipKjXfH20/h16cmPXiCBSzytifiso1TKqulJB3S6nGHotgXo1OcMK90wGKRH8SIB4IBrLNEOY1uVA1RIvGjQePvoIxe29T0Ic+U0QFtOd1eU9E/zmrpeWIlz+e0rqNdVdBlT5lyKiNfZnJzSgzH00hAvObtIaPYWvARriHiVlsriHofl+unjVP3gU476lif2C0iLV/Wyz/uWZnrco0vX2kp4G2AxM9y4fFPSCk522wMRtUFuzsMqdxPTcyA0u1GdbZ1PITcb+/5rypsqR5JpwugyoSknBzYxrD/RTB+S/HMMlqU9L13ldKsmgsYXDTJaJ/bYEmv6FlijMxIM5W0J8q+RCDoBll+F8/Dtwa2fPZg2TzkUmSArUtBz8zZJxa+Ov/F9O/X+AnX6ZbHQqyibFYTeJwRYKFMtPAH6uwUj+zdIV54u3AWnbKlY/pN3N3oG+mbgriy3XtitOXCXInWyCOAjHhVYlSRxjEajAA/NFTFxgcJVY0XW/dyNpNvAJEhr2uDDh3jGonlg8M5ZXu7N7PcH0HgIQjWgvSvDHkM+AhzMsYrp+pqFyQFNpzXyiaGJo6kWLcL5H4nVgOWl2GXvKTdOjnBQGm2+gUBTDDXHQnTeI6AGYl10A64cVKu7L6Ol2Hn82ZPIvpyMKvetHIT8Nzdm9fNRb8RXVJMwWBe+s+TWbkbBfgsas4h7v73lqUefzws5tOyBVpuAFTsAJ+8x0PkAfWnvIaiDoD1y3qnXlOaRGS/PqMBtb/MaSXhZTvaHxxvD1U3KM/OrqQsZRINjZ3Qld0o2NuH1fqE+N4SKq7XaZco/E5BRAj47F8PZB9w33HQT2RP+bwzTJJYls+g1Z5vBi3klIiI3bscDQ9xzPOlQOawbKhkxGucBEMDPUgz2SGUa7mjzr4GXyhJ3eXBI/gc+aONJVotxEAlXkO5eusc1sF2aYzsGH1eTgqWq6f6O5OKTEW15nJKdeFthuXAsWgOsMaFZFIxAz8HUokBv5RXYD3fnXYJIL2q9X6wYxX248GKepdt7StV9uEM9XEMZo6dRXK1lLQcyPUDNwY6NRqYVW47xeAKzL25NjCrfNs6NIDEZibNiO82caj7SSixAMaq8jTJup7qzvjcN4pfAeRyO4ojPDiy/IX1a+9HXQiufuUREqsGh1MCdzGdChuQiiAslGdiP/e7Pc9n0o9tWkepAbCRj/CyPlLe80/OHUfMlKwznHYQ3HWyG7j1F+yOQFYFqZS4tPlL7FjA6z2B/SswUj+lxnMYLtydS5Pdow9MdwJx'
        },
        cards: []
    }
];
