/**
 * How the ranking is actually computed — both the AHP-level question ("how
 * do criterion weights turn into a 0-100 score") and the question one level
 * down ("what is 'ความตรงต่อเวลา' actually made of"). Static and
 * server-rendered: this never needs to react to anything, so a native
 * <details> disclosure is enough — no client component for a toggle.
 */
export function ScoringMethodology() {
  return (
    <details className="panel px-4 py-4 text-small leading-relaxed text-ink-soft">
      <summary className="cursor-pointer text-small font-medium text-ink">
        วิธีคำนวณคะแนนและอันดับ
      </summary>

      <div className="mt-4 flex flex-col gap-4">
        <section>
          <h3 className="text-micro font-medium text-ink-faint">ภาพรวม 4 ขั้น</h3>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5">
            <li>
              <strong className="font-medium text-ink">น้ำหนักเกณฑ์</strong> — จากการเทียบทีละคู่
              (เมทริกซ์ Saaty 1–9) คำนวณด้วย eigenvector ไม่ใช่การเฉลี่ยเฉยๆ
            </li>
            <li>
              <strong className="font-medium text-ink">คะแนนย่อยต่อเกณฑ์</strong> — แต่ละสายเรือได้คะแนน
              0–1 ต่อเกณฑ์ โดยเทียบกับสายเรือที่ดีที่สุดในกลุ่มที่กำลังเปรียบเทียบ (ideal-mode):
              เกณฑ์ที่ยิ่งมากยิ่งดี ใช้ ค่าของสาย ÷ ค่าสูงสุด เกณฑ์ที่ยิ่งน้อยยิ่งดี (ต้นทุน, ระยะเวลา) ใช้
              ค่าต่ำสุด ÷ ค่าของสาย
            </li>
            <li>
              <strong className="font-medium text-ink">คะแนนรวม</strong> — ผลรวมของ (น้ำหนักเกณฑ์ ×
              คะแนนย่อย) ทุกเกณฑ์
            </li>
            <li>
              <strong className="font-medium text-ink">คะแนน 0–100</strong> — คะแนนรวมถูกปรับสเกลให้
              สายเรือที่ดีที่สุดได้ 100 แล้วคิดสายอื่นเป็นสัดส่วนเทียบกัน
            </li>
          </ol>
        </section>

        <section>
          <h3 className="text-micro font-medium text-ink-faint">
            ตัวชี้วัดย่อยในแต่ละเกณฑ์คิดยังไง
          </h3>
          <p className="mt-1.5">
            ทั้ง 5 เกณฑ์ไม่ได้มาจากช่องกรอกเดียว บางเกณฑ์รวมตัวเลขหลายช่องด้วยสูตรตายตัว (ไม่ใช่น้ำหนักที่ปรับได้
            เหมือนเกณฑ์หลัก) ดังนี้:
          </p>
          <ul className="mt-1.5 space-y-2">
            <li>
              <strong className="font-medium text-ink">ต้นทุน</strong> — (Ocean + Local) − (Free Time
              × มูลค่า/วัน) · ยิ่งน้อยยิ่งดี
            </li>
            <li>
              <strong className="font-medium text-ink">ระยะเวลาขนส่ง</strong> — วันเดินทางที่กรอก + (1 วัน
              ต่อการถ่ายลำแต่ละครั้ง) · ยิ่งน้อยยิ่งดี
            </li>
            <li>
              <strong className="font-medium text-ink">ความตรงต่อเวลา</strong> — % ตรงเวลา − (3 แต้ม ต่อ
              blank sailing หนึ่งครั้งต่อไตรมาส) · ยิ่งมากยิ่งดี
            </li>
            <li>
              <strong className="font-medium text-ink">ระวาง/ตู้คอนเทนเนอร์</strong> — คะแนนความพร้อมตู้
              (1–10) หักวันละ 1 แต้ม สำหรับทุก 24 ชั่วโมงที่ตอบยืนยัน booking ช้ากว่ามาตรฐาน 24 ชม. ·
              ยิ่งมากยิ่งดี
            </li>
            <li>
              <strong className="font-medium text-ink">บริการและเอกสาร</strong> — คะแนนบริการ (1–10)
              หักแบบเดียวกันตามความล่าช้าของการออก draft B/L เกินมาตรฐาน 24 ชม. · ยิ่งมากยิ่งดี
            </li>
          </ul>
        </section>

        <p className="text-micro text-ink-faint">
          สูตรย่อยเหล่านี้เป็นค่าคงที่ที่กำหนดไว้ในระบบ ไม่ใช่สิ่งที่ผู้ใช้ปรับน้ำหนักได้ — ส่วนที่ปรับได้คือ
          น้ำหนักระหว่าง 5 เกณฑ์หลักที่เมทริกซ์ด้านล่างเท่านั้น
        </p>
      </div>
    </details>
  );
}
