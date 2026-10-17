import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PublicInvoice } from "@/lib/public-invoice";
import { formatMinorAmount } from "@/lib/money";

const styles = StyleSheet.create({
  page: { paddingTop: 42, paddingHorizontal: 44, paddingBottom: 62, color: "#14231B", fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.45 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 2, borderBottomColor: "#2F6B3F", paddingBottom: 18, marginBottom: 24 },
  issuer: { flexDirection: "row", alignItems: "center", gap: 12, maxWidth: 300 },
  logo: { width: 56, height: 56, objectFit: "contain" },
  brand: { color: "#2F6B3F", fontSize: 15, fontFamily: "Helvetica-Bold" },
  companyName: { marginTop: 3, fontSize: 11, fontFamily: "Helvetica-Bold" },
  muted: { color: "#5B6B61", fontSize: 9 },
  invoiceTitle: { alignItems: "flex-end" },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  invoiceNumber: { marginTop: 3, color: "#2F6B3F", fontSize: 12, fontFamily: "Helvetica-Bold" },
  status: { marginTop: 5, color: "#5B6B61", fontSize: 8, textTransform: "uppercase" },
  details: { flexDirection: "row", gap: 16, marginBottom: 24 },
  detailBlock: { flexGrow: 1, flexBasis: 0, padding: 12, backgroundColor: "#F1F5EC", borderRadius: 5 },
  heading: { marginBottom: 7, color: "#5B6B61", fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.4 },
  strong: { marginBottom: 2, fontFamily: "Helvetica-Bold" },
  lineHeader: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 8, backgroundColor: "#14231B", color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 8 },
  line: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#D8E1D3" },
  description: { flexGrow: 1, flexBasis: 0, paddingRight: 8 },
  quantity: { width: 45, textAlign: "right" },
  unitPrice: { width: 95, textAlign: "right" },
  lineTotal: { width: 95, textAlign: "right" },
  totalWrap: { alignItems: "flex-end", marginTop: 18 },
  totalCard: { minWidth: 205, padding: 12, backgroundColor: "#F1F5EC", borderRadius: 5 },
  totalLabel: { color: "#5B6B61", fontSize: 9 },
  total: { marginTop: 3, color: "#2F6B3F", fontSize: 20, fontFamily: "Helvetica-Bold" },
  note: { marginTop: 28, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#D8E1D3", color: "#5B6B61", textAlign: "center", fontSize: 8 },
  footer: { position: "absolute", left: 44, right: 44, bottom: 25, borderTopWidth: 1, borderTopColor: "#D8E1D3", paddingTop: 8, color: "#5B6B61", fontSize: 8, textAlign: "center" },
});

function frenchDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

const statusLabels = { sent: "Envoyée", paid: "Payée", overdue: "En retard" };

export default function InvoicePdf({ data, logoUrl }: { data: PublicInvoice; logoUrl: string | null }) {
  const { invoice, company, client, lines } = data;
  return (
    <Document title={`Facture ${invoice.invoice_number}`} author={company.company_name}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <View style={styles.issuer}>
            {logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- React-PDF Image does not expose an alt prop.
              <Image style={styles.logo} src={logoUrl} />
            ) : <Text style={styles.brand}>FACTURO</Text>}
            <View>
              <Text style={styles.companyName}>{company.company_name}</Text>
              <Text style={styles.muted}>Document commercial</Text>
            </View>
          </View>
          <View style={styles.invoiceTitle}>
            <Text style={styles.title}>FACTURE</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
            <Text style={styles.status}>{statusLabels[invoice.effective_status]}</Text>
          </View>
        </View>

        <View style={styles.details}>
          <View style={styles.detailBlock}>
            <Text style={styles.heading}>Vendeur</Text>
            <Text style={styles.strong}>{company.company_name}</Text>
            {company.address && <Text>{company.address}</Text>}
            {company.phone && <Text>{company.phone}</Text>}
            {company.rccm && <Text>RCCM : {company.rccm}</Text>}
            {company.nif && <Text>NIF : {company.nif}</Text>}
          </View>
          <View style={styles.detailBlock}>
            <Text style={styles.heading}>Facturé à</Text>
            <Text style={styles.strong}>{client.name}</Text>
            {client.address && <Text>{client.address}</Text>}
            {client.nif && <Text>NIF : {client.nif}</Text>}
          </View>
          <View style={styles.detailBlock}>
            <Text style={styles.heading}>Informations de facture</Text>
            <Text>Émise le {frenchDate(invoice.issued_at)}</Text>
            <Text>Échéance le {frenchDate(invoice.due_date)}</Text>
            {invoice.order_reference && <Text>Marché / bon de commande : {invoice.order_reference}</Text>}
          </View>
        </View>

        <View style={styles.lineHeader} fixed>
          <Text style={styles.description}>Description</Text>
          <Text style={styles.quantity}>Qté</Text>
          <Text style={styles.unitPrice}>Prix unitaire</Text>
          <Text style={styles.lineTotal}>Montant</Text>
        </View>
        {lines.map((line, index) => (
          <View style={styles.line} key={`${line.description}-${index}`} wrap={false}>
            <Text style={styles.description}>{line.description}{line.unit ? ` · ${line.unit}` : ""}</Text>
            <Text style={styles.quantity}>{line.quantity.replace(".", ",")}</Text>
            <Text style={styles.unitPrice}>{formatMinorAmount(line.unit_price, invoice.currency)}</Text>
            <Text style={styles.lineTotal}>{formatMinorAmount(line.line_total, invoice.currency)}</Text>
          </View>
        ))}

        <View style={styles.totalWrap}>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total à payer · {invoice.currency}</Text>
            <Text style={styles.total}>{formatMinorAmount(invoice.total_amount, invoice.currency)}</Text>
          </View>
        </View>
        <Text style={styles.note}>Document commercial, non certifié par la DGI.</Text>
        <Text style={styles.footer} fixed>{company.company_name} · {invoice.invoice_number} · Échéance : {frenchDate(invoice.due_date)}</Text>
      </Page>
    </Document>
  );
}
