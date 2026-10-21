const demoItems = [
  { name: "Consultation", unit: "heure", currency: "USD", price: "$40.00" },
  { name: "Maintenance informatique", unit: "intervention", currency: "USD", price: "$50.00" },
  { name: "Transport de marchandises", unit: "trajet", currency: "CDF", price: "35 000 FC" },
];

export default function CatalogPreviewPage() {
  return <main className="public-shell"><div className="workspace-wrap">
    <p className="eyebrow">Aperçu local · données fictives</p>
    <h1>Catalogue</h1>
    <p className="lead">Voici le nouvel affichage du partage dans la liste du catalogue.</p>
    <section className="panel">
      <div className="section-title-row"><h2>Produits et services</h2><button className="button small primary" disabled>Partager le catalogue</button></div>
      <p className="note">Le bouton crée un lien public que vous pourrez ouvrir, copier ou envoyer par WhatsApp.</p>
      <div className="scroll"><table><thead><tr><th>Nom</th><th>Unité</th><th>Devise</th><th className="right">Prix</th><th>État</th><th>Actions</th></tr></thead>
        <tbody>{demoItems.map((item) => <tr key={item.name}><td>{item.name}</td><td>{item.unit}</td><td>{item.currency}</td><td className="right">{item.price}</td><td>Actif</td><td><div className="share-actions catalog-item-actions"><button className="button small ok" disabled>Partager</button><button className="button small" disabled>Archiver</button></div></td></tr>)}</tbody>
      </table></div>
      <p className="message" role="status">Aperçu seulement : aucun partage n’est activé et aucune donnée Supabase n’est modifiée.</p>
    </section>
  </div></main>;
}
