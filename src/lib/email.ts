import nodemailer from "nodemailer";

const port = Number(process.env.SMTP_PORT ?? 465);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export type Email = {
  destinataire: string;
  objet: string;
  corps: string;
};

export async function envoyerEmail(email: Email): Promise<{ messageId: string }> {
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email.destinataire,
    subject: email.objet,
    text: email.corps,
  });
  return { messageId: info.messageId };
}
