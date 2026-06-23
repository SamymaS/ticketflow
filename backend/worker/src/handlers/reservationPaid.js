import QRCode from 'qrcode';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { pool } from '../db.js';
import { putObject } from '../storage.js';
import { logger } from '../logger.js';

async function buildTicketPdf({ eventTitle, venue, startsAt, seatSection, seatRow, seatNumber, priceCents, qrText, reservationId }) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 595]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const txt = (t, x, y, size = 11, f = font, color = rgb(0.1, 0.1, 0.1)) =>
    page.drawText(String(t), { x, y, size, font: f, color });

  const divider = (y) =>
    page.drawLine({ start: { x: 30, y }, end: { x: 390, y }, thickness: 0.5, color: rgb(0.78, 0.78, 0.78) });

  // En-tête coloré
  page.drawRectangle({ x: 0, y: 557, width: 420, height: 38, color: rgb(0.424, 0.388, 1) });
  txt('TicketFlow', 30, 569, 18, bold, rgb(1, 1, 1));

  // Infos événement
  txt('BILLET D\'ENTRÉE', 30, 537, 8, font, rgb(0.5, 0.5, 0.5));
  txt(eventTitle, 30, 518, 15, bold);
  txt(venue, 30, 499, 11, font, rgb(0.35, 0.35, 0.35));

  const dateStr = new Date(startsAt).toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  txt(dateStr, 30, 481, 10, font, rgb(0.35, 0.35, 0.35));

  divider(469);

  // Infos siège
  txt('VOTRE PLACE', 30, 454, 8, font, rgb(0.5, 0.5, 0.5));
  txt(`Section :  ${seatSection}`, 30, 437, 11);
  txt(`Rangée :   ${seatRow}`, 30, 419, 11);
  txt(`Siège N° : ${seatNumber}`, 30, 401, 12, bold);
  txt(`Prix :     ${(priceCents / 100).toFixed(2)} €`, 30, 383, 11);

  divider(371);

  // QR code centré
  const qrPng = await QRCode.toBuffer(qrText, { width: 200, margin: 1 });
  const qrImg = await pdf.embedPng(qrPng);
  page.drawImage(qrImg, { x: 110, y: 152, width: 200, height: 200 });
  txt('Présentez ce QR code à l\'entrée', 88, 130, 9, font, rgb(0.4, 0.4, 0.4));

  divider(118);

  // Pied de page
  const shortRef = reservationId.slice(0, 8).toUpperCase();
  txt(`Réf. réservation : ${shortRef}`, 30, 100, 8, font, rgb(0.5, 0.5, 0.5));
  txt(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 30, 82, 8, font, rgb(0.5, 0.5, 0.5));

  return pdf.save();
}

export async function handleReservationPaid({ reservationId }) {
  const existing = await pool.query('SELECT 1 FROM tickets WHERE reservation_id = $1 LIMIT 1', [reservationId]);
  if (existing.rowCount > 0) {
    logger.info({ reservationId }, 'billets déjà générés — skip (idempotent)');
    return;
  }

  const { rows } = await pool.query(
    `SELECT s.id AS seat_id, s.section, s.row_label, s.number, s.price_cents,
            e.title, e.venue, e.starts_at
     FROM reservation_seats rs
     JOIN seats s ON s.id = rs.seat_id
     JOIN reservations r ON r.id = rs.reservation_id
     JOIN events e ON e.id = r.event_id
     WHERE rs.reservation_id = $1`,
    [reservationId]
  );

  for (const row of rows) {
    const qrText = `ticketflow:${reservationId}:${row.seat_id}`;
    const pdfBytes = await buildTicketPdf({
      eventTitle: row.title,
      venue: row.venue,
      startsAt: row.starts_at,
      seatSection: row.section,
      seatRow: row.row_label,
      seatNumber: row.number,
      priceCents: row.price_cents,
      qrText,
      reservationId,
    });
    const pdfUrl = await putObject(`${reservationId}/${row.seat_id}.pdf`, Buffer.from(pdfBytes), 'application/pdf');

    await pool.query(
      `INSERT INTO tickets (reservation_id, seat_id, qr_code, pdf_url)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (reservation_id, seat_id) DO NOTHING`,
      [reservationId, row.seat_id, qrText, pdfUrl]
    );
  }

  logger.info({ reservationId, tickets: rows.length }, 'billets générés');
}
