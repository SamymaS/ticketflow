import QRCode from 'qrcode';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { pool } from '../db.js';
import { putObject } from '../storage.js';
import { logger } from '../logger.js';

async function buildTicketPdf({ eventTitle, venue, seatLabel, qrText }) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 595]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const draw = (t, x, y, size = 12, f = font) => page.drawText(t, { x, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });

  draw('TicketFlow', 40, 540, 22, bold);
  draw(eventTitle, 40, 500, 16, bold);
  draw(venue, 40, 478, 12);
  draw(`Place : ${seatLabel}`, 40, 450, 14, bold);

  const qrPng = await QRCode.toBuffer(qrText, { width: 220, margin: 1 });
  const qrImg = await pdf.embedPng(qrPng);
  page.drawImage(qrImg, { x: 100, y: 180, width: 220, height: 220 });
  draw('Présentez ce QR code à l\'entrée', 90, 150, 10);
  return pdf.save();
}

// Idempotent : si les billets existent déjà pour cette réservation, on ne refait rien.
export async function handleReservationPaid({ reservationId }) {
  const existing = await pool.query('SELECT 1 FROM tickets WHERE reservation_id = $1 LIMIT 1', [reservationId]);
  if (existing.rowCount > 0) {
    logger.info({ reservationId }, 'billets déjà générés — skip (idempotent)');
    return;
  }

  const { rows } = await pool.query(
    `SELECT s.id AS seat_id, s.section, s.row_label, s.number, e.title, e.venue
     FROM reservation_seats rs
     JOIN seats s ON s.id = rs.seat_id
     JOIN reservations r ON r.id = rs.reservation_id
     JOIN events e ON e.id = r.event_id
     WHERE rs.reservation_id = $1`,
    [reservationId]
  );

  for (const row of rows) {
    const seatLabel = `${row.section} ${row.row_label}${row.number}`;
    const qrText = `ticketflow:${reservationId}:${row.seat_id}`;
    const pdfBytes = await buildTicketPdf({ eventTitle: row.title, venue: row.venue, seatLabel, qrText });
    const pdfUrl = await putObject(`${reservationId}/${row.seat_id}.pdf`, Buffer.from(pdfBytes), 'application/pdf');

    await pool.query(
      `INSERT INTO tickets (reservation_id, seat_id, qr_code, pdf_url)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (reservation_id, seat_id) DO NOTHING`,
      [reservationId, row.seat_id, qrText, pdfUrl]
    );
  }

  // Email de confirmation : stub loggé (hors scope MVP).
  logger.info({ reservationId, tickets: rows.length }, 'billets générés + email (stub) envoyé');
}
