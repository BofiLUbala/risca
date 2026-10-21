import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';

/** Recu automatique par e-mail au format PDF (section 10.4). */
@Injectable()
export class ReceiptsService {
  constructor(private prisma: PrismaService) {}

  async generate(donationId: string): Promise<Buffer> {
    const donation = await this.prisma.donation.findUnique({
      where: { id: donationId },
      include: {
        donor: { select: { firstName: true, lastName: true, email: true } },
        child: { select: { firstName: true, publicId: true } },
        project: { select: { title: true } },
      },
    });
    if (!donation) throw new NotFoundException('Don introuvable');

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));

    doc.fontSize(20).fillColor('#0a7ea4').text('RISAC', { align: 'left' });
    doc.fontSize(9).fillColor('#555').text('Réseau International des Structures d’Accueil du Congo');
    doc.text('ONG Congo Meilleur ASBL');
    doc.moveDown(1.5);

    doc.fontSize(16).fillColor('#111').text('Reçu de don');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#444');
    doc.text(`Reference : ${donation.reference}`);
    doc.text(`Date : ${(donation.paidAt ?? donation.createdAt).toLocaleDateString('fr-FR')}`);
    doc.moveDown(1);

    doc.fontSize(11).fillColor('#111').text('Bailleur');
    doc.fontSize(10).fillColor('#444');
    doc.text(`${donation.donor.firstName} ${donation.donor.lastName}`);
    doc.text(donation.donor.email);
    doc.moveDown(1);

    doc.fontSize(11).fillColor('#111').text('Affectation');
    doc.fontSize(10).fillColor('#444');
    if (donation.project) doc.text(`Projet : ${donation.project.title}`);
    else if (donation.child) doc.text(`Enfant : ${donation.child.firstName} (${donation.child.publicId})`);
    else doc.text('Global Congo Children Fund (fonds général)');
    doc.moveDown(1);

    doc.fontSize(11).fillColor('#111').text('Montant');
    doc.fontSize(10).fillColor('#444');
    doc.text(`Montant verse : ${donation.amount.toFixed(2)} ${donation.currency}`);
    doc.text(`Equivalent USD : ${donation.amountUsd.toFixed(2)} USD (taux ${donation.exchangeRate})`);
    doc.text(`Frais de fonctionnement : ${donation.feeAmount.toFixed(2)} USD`);
    doc.text(`Montant affecte : ${donation.netAmount.toFixed(2)} USD`);
    doc.moveDown(2);

    doc.fontSize(8).fillColor('#777');
    doc.text('Ce reçu est généré automatiquement par la plateforme RISAC.', { align: 'center' });
    doc.text('Merci de votre soutien a l’enfance vulnerable en République Démocratique du Congo.', {
      align: 'center',
    });

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
