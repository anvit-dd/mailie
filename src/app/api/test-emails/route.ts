import { NextRequest, NextResponse } from 'next/server'

// Pre-built dummy HTML emails for testing iframe rendering
const TEST_EMAILS: Record<string, string> = {
  // 1. Plain text — no explicit background, tests default light rendering
  'plain-text': `<p>Hi there,</p>
<p>This is a plain HTML email with no explicit background color. It should render with a white background and dark text — not dark mode!</p>
<p>Check the background: is it white or dark?</p>
<p>Line 1<br>Line 2<br>Line 3<br>Line 4<br>Line 5</p>
<p>Thanks,<br>Test Bot</p>`,

  // 2. HTML with NO background — should be white (forced by viewer CSS)
  'no-bg': `<h2>Welcome to EduPath!</h2>
<p>Hi <strong>Anvit</strong>,</p>
<p>Your course progress report is ready. Keep up the great work!</p>
<table style="width:100%;border-collapse:collapse;">
  <tr><th style="border:1px solid #ccc;padding:8px;text-align:left;">Course</th><th style="border:1px solid #ccc;padding:8px;text-align:left;">Progress</th><th style="border:1px solid #ccc;padding:8px;text-align:left;">Status</th></tr>
  <tr><td style="border:1px solid #ccc;padding:8px;">Web Development</td><td style="border:1px solid #ccc;padding:8px;">75%</td><td style="border:1px solid #ccc;padding:8px;">In Progress</td></tr>
  <tr><td style="border:1px solid #ccc;padding:8px;">Data Science</td><td style="border:1px solid #ccc;padding:8px;">30%</td><td style="border:1px solid #ccc;padding:8px;">Started</td></tr>
</table>
<p><a href="https://edupath.example.com">View full report →</a></p>`,

  // 3. HTML with EXPLICIT white background — should render white
  'white-bg': `<div style="background:#ffffff;color:#1a1a1a;padding:20px;font-family:sans-serif;">
<h1 style="color:#1a1a1a;">White Background Email</h1>
<p>This email has an <strong>explicit white background</strong>. It should look completely normal.</p>
<p style="background:#f5f5f5;padding:10px;border-radius:4px;">This paragraph has a light gray background.</p>
<img src="https://placehold.co/600x200/ffffff/1a1a1a?text=White+BG+Image" alt="test" style="max-width:100%;border:1px solid #ddd;">
<p><a href="#">Normal link</a></p>
</div>`,

  // 4. HTML with EXPLICIT dark background — tests color-scheme and contrast
  'dark-bg': `<div style="background:#1a1a1a;color:#ffffff;padding:20px;font-family:sans-serif;">
<h1 style="color:#ffffff;margin-top:0;">🎉 Dark Background Email</h1>
<p>This email has an <strong style="color:#ffffff;">explicit dark background</strong>.</p>
<p style="background:#333;padding:10px;color:#fff;border-radius:4px;">This inner div is also dark.</p>
<img src="https://placehold.co/600x200/1a1a1a/ffffff?text=Dark+BG+Image" alt="test" style="max-width:100%;border:1px solid #444;">
<p><a href="#" style="color:#66b3ff;">Light blue link</a></p>
<blockquote style="border-left:3px solid #555;padding-left:14px;color:#aaa;margin:1em 0;">
  <p style="color:#aaa;">This blockquote should also be readable against dark bg.</p>
</blockquote>
</div>`,

  // 5. Table-heavy layout (simulates EduPath) — tests table border handling
  'table-heavy': `<div style="padding:16px;font-family:sans-serif;">
<h2>📚 EduPath — Weekly Digest</h2>
<p>Here's your personalized learning digest for this week.</p>

<h3>📈 Your Stats</h3>
<table style="width:100%;border-collapse:collapse;">
  <tr><th style="border:1px solid #ddd;padding:10px;background:#f9f9f9;text-align:left;">Metric</th><th style="border:1px solid #ddd;padding:10px;background:#f9f9f9;text-align:left;">Value</th><th style="border:1px solid #ddd;padding:10px;background:#f9f9f9;text-align:left;">Change</th></tr>
  <tr><td style="border:1px solid #ddd;padding:10px;">Hours Learned</td><td style="border:1px solid #ddd;padding:10px;">12.5</td><td style="border:1px solid #ddd;padding:10px;">↑ 2.3</td></tr>
  <tr><td style="border:1px solid #ddd;padding:10px;">Courses Active</td><td style="border:1px solid #ddd;padding:10px;">4</td><td style="border:1px solid #ddd;padding:10px;">—</td></tr>
  <tr><td style="border:1px solid #ddd;padding:10px;">Quizzes Passed</td><td style="border:1px solid #ddd;padding:10px;">8</td><td style="border:1px solid #ddd;padding:10px;">↑ 3</td></tr>
</table>

<h3>🔥 Trending Courses</h3>
<table style="width:100%;border-collapse:collapse;">
  <tr><th style="border:1px solid #ddd;padding:10px;background:#f9f9f9;text-align:left;">Course</th><th style="border:1px solid #ddd;padding:10px;background:#f9f9f9;text-align:left;">Category</th></tr>
  <tr><td style="border:1px solid #ddd;padding:10px;">Advanced React Patterns</td><td style="border:1px solid #ddd;padding:10px;">Frontend</td></tr>
  <tr><td style="border:1px solid #ddd;padding:10px;">Machine Learning Basics</td><td style="border:1px solid #ddd;padding:10px;">Data</td></tr>
  <tr><td style="border:1px solid #ddd;padding:10px;">System Design Interview</td><td style="border:1px solid #ddd;padding:10px;">Backend</td></tr>
</table>

<p><a href="#">Open EduPath →</a></p>
</div>`,

  // 6. Very long content — tests scroll behavior
  'long-content': `<h2>Long Email Test</h2>
<p>This email has a LOT of content to test scrolling behavior.</p>
${Array.from({ length: 60 }, (_, i) => `<p>Paragraph ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>`).join('\n')}
<p>END OF EMAIL</p>`,

  // 7. Wide content — tests horizontal overflow
  'wide-content': `<h2>Wide Table Test</h2>
<p>This email has a very wide table to test horizontal overflow handling.</p>
<table style="border-collapse:collapse;white-space:nowrap;">
  <tr>
    <th style="border:1px solid #ccc;padding:8px;background:#f5f5f5;">Name</th>
    <th style="border:1px solid #ccc;padding:8px;background:#f5f5f5;">Email</th>
    <th style="border:1px solid #ccc;padding:8px;background:#f5f5f5;">Phone</th>
    <th style="border:1px solid #ccc;padding:8px;background:#f5f5f5;">Address</th>
    <th style="border:1px solid #ccc;padding:8px;background:#f5f5f5;">City</th>
    <th style="border:1px solid #ccc;padding:8px;background:#f5f5f5;">State</th>
    <th style="border:1px solid #ccc;padding:8px;background:#f5f5f5;">Zip</th>
    <th style="border:1px solid #ccc;padding:8px;background:#f5f5f5;">Country</th>
    <th style="border:1px solid #ccc;padding:8px;background:#f5f5f5;">Notes</th>
    <th style="border:1px solid #ccc;padding:8px;background:#f5f5f5;">Tags</th>
  </tr>
  ${Array.from({ length: 5 }, (_, i) => `
  <tr>
    <td style="border:1px solid #ccc;padding:8px;">Person ${i + 1}</td>
    <td style="border:1px solid #ccc;padding:8px;">person${i + 1}@example.com</td>
    <td style="border:1px solid #ccc;padding:8px;">+1-555-${String(i + 100).padStart(7, '0')}</td>
    <td style="border:1px solid #ccc;padding:8px;">${i + 1} Main Street</td>
    <td style="border:1px solid #ccc;padding:8px;">New York</td>
    <td style="border:1px solid #ccc;padding:8px;">NY</td>
    <td style="border:1px solid #ccc;padding:8px;">${10001 + i}</td>
    <td style="border:1px solid #ccc;padding:8px;">USA</td>
    <td style="border:1px solid #ccc;padding:8px;">This is a very long note that should cause horizontal scrolling.</td>
    <td style="border:1px solid #ccc;padding:8px;">tag1, tag2, tag3</td>
  </tr>`).join('')}
</table>
<p><strong>Test:</strong> Can you scroll horizontally? Is content clipped?</p>`,

  // 8. LinkedIn-style email — tests nested tables and dark sections
  'linkedin-style': `<div style="background:#ffffff;padding:20px;font-family:Arial,sans-serif;">
<table style="width:100%;max-width:600px;margin:0 auto;">
  <tr>
    <td style="background:#1a1a1a;padding:20px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:24px;">🔔 LinkedIn</h1>
    </td>
  </tr>
  <tr>
    <td style="background:#f5f5f5;padding:20px;">
      <p style="color:#1a1a1a;font-size:14px;">Hi <strong>Anvit</strong>,</p>
      <p style="color:#1a1a1a;font-size:14px;">You have <strong>5 new connections</strong> this week!</p>
      <table style="width:100%;margin-top:16px;">
        <tr>
          <td style="padding:8px;border-bottom:1px solid #ddd;"><strong>John Smith</strong> — Software Engineer at Google</td>
        </tr>
        <tr>
          <td style="padding:8px;border-bottom:1px solid #ddd;"><strong>Jane Doe</strong> — Product Manager at Meta</td>
        </tr>
        <tr>
          <td style="padding:8px;"><strong>Bob Wilson</strong> — Designer at Stripe</td>
        </tr>
      </table>
      <p style="margin-top:20px;"><a href="#" style="background:#0077b5;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:4px;display:inline-block;">View all</a></p>
    </td>
  </tr>
  <tr>
    <td style="background:#fafafa;padding:12px;text-align:center;border-top:1px solid #ddd;">
      <p style="color:#666;font-size:11px;margin:0;">LinkedIn Corporation · 1000 W Maude Ave · Sunnyvale, CA 94085</p>
    </td>
  </tr>
</table>
</div>`,

  // 9. Email with images of different sizes — tests image rendering
  'image-heavy': `<h2>Image Test Email</h2>
<p>This email has images of various sizes to test rendering:</p>
<h3>Small image (100x100)</h3>
<img src="https://placehold.co/100x100/ff6b6b/ffffff?text=100x100" alt="small" style="border:1px solid red;">
<h3>Medium image (300x200)</h3>
<img src="https://placehold.co/300x200/4ecdc4/ffffff?text=300x200" alt="medium" style="border:1px solid teal;">
<h3>Large image (600x300)</h3>
<img src="https://placehold.co/600x300/45b7d1/ffffff?text=600x300" alt="large" style="border:1px solid blue;">
<h3>Extra wide (800x100)</h3>
<img src="https://placehold.co/800x100/f093fb/ffffff?text=Extra+Wide+800x100" alt="wide" style="border:1px solid purple;">
<p>End of images.</p>`,

  // 10. font tag with no bgcolor — tests our CSS override
  'font-tag-no-bg': `<font face="Arial" size="4" color="#0066cc">
  <h2>Font Tag Test</h2>
  <p>This uses the old &lt;font&gt; tag without bgcolor. Does it render correctly?</p>
  <p><strong>Bold text</strong> and <em>italic text</em> and <u>underlined text</u></p>
  <p><center>This is centered text inside font tag.</center></p>
  <p>Regular paragraph after.</p>
</font>`,
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'plain-text'

  const html = TEST_EMAILS[type]
  if (!html) {
    return NextResponse.json({ error: 'Unknown test email type' }, { status: 404 })
  }

  return NextResponse.json({ html })
}
