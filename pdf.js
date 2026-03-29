// ════════════════════════════════════════════════════
// PDF.JS — Exportar relatório PDF
// ════════════════════════════════════════════════════

function exportPDF() {
  var jsPDF = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDF) return alert('Biblioteca PDF não carregada.');
  if (!activeClient) return alert('Selecione um cliente.');
  var c   = data.clients[activeClient];
  var doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  var W = 210, M = 14, y = M;
  var hoje   = new Date().toLocaleDateString('pt-BR');
  var fmtVal = v => 'R$ ' + Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  // Cabeçalho
  doc.setFillColor(30,35,54); doc.rect(0,0,W,28,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor(255,255,255);
  doc.text('Granafy', M, 12);
  doc.setFontSize(10); doc.setFont('helvetica','normal');
  doc.text('Relatório Financeiro — ' + c.name, M+30, 12);
  doc.text('Gerado em ' + hoje, W-M, 19, {align:'right'});
  doc.setFontSize(8); doc.setTextColor(150,175,220);
  doc.text('Desenvolvido por Levy Lima - Teste Beta Granafy', M, 23);
  y = 36;

  var todas = getTransacoes(activeClient);
  var tR = todas.filter(l=>l.tipo==='credito').reduce((s,l)=>s+l.valor,0);
  var tD = todas.filter(l=>l.tipo==='debito').reduce((s,l)=>s+l.valor,0);
  var saldo = tR-tD;
  var faturaTotal = (c.cartao||[]).filter(it=>it.tipo!=='estorno').reduce((s,it)=>s+Number(it.valor),0)
    - (c.cartao||[]).filter(it=>it.tipo==='estorno').reduce((s,it)=>s+Number(it.valor),0);

  // Resumo geral
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(30,35,54);
  doc.text('RESUMO GERAL', M, y); y+=6;
  doc.setDrawColor(91,140,255); doc.setLineWidth(.4); doc.line(M,y,W-M,y); y+=5;
  var cards = [['Total Receitas',fmtVal(tR),'#1fad90'],['Total Despesas',fmtVal(tD),'#e03b3b'],['Resultado',fmtVal(saldo),saldo>=0?'#1fad90':'#e03b3b'],['Fatura Cartão',fmtVal(faturaTotal),'#d4900a']];
  var cw = (W-M*2-9)/4;
  cards.forEach(([lbl,val,cor],i) => {
    var cx = M+i*(cw+3);
    doc.setFillColor(240,242,248); doc.roundedRect(cx,y,cw,18,2,2,'F');
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(90,96,122); doc.text(lbl.toUpperCase(),cx+cw/2,y+6,{align:'center'});
    var rgb = cor==='#1fad90'?[31,173,144]:cor==='#e03b3b'?[224,59,59]:[212,144,10];
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...rgb); doc.text(val,cx+cw/2,y+13,{align:'center'});
  });
  y+=26;

  // DRE resumido
  var fixas    = todas.filter(l=>l.tipo==='debito'&&tipoCat(l.cat)==='fixa');
  var variaveis = todas.filter(l=>l.tipo==='debito'&&tipoCat(l.cat)!=='fixa');
  var tFix = fixas.reduce((s,l)=>s+l.valor,0);
  var tVar = variaveis.reduce((s,l)=>s+l.valor,0);
  var txPoup = tR>0?((tR-tD)/tR*100).toFixed(1)+'%':'—';
  if (y>230){doc.addPage();y=M;}
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(30,35,54);
  doc.text('DRE — DEMONSTRAÇÃO DO RESULTADO',M,y); y+=4;
  doc.setDrawColor(91,140,255); doc.line(M,y,W-M,y); y+=3;
  doc.autoTable({startY:y,head:[['Descrição','Valor']],body:[
    ['(+) Receita Total',fmtVal(tR)],
    ['(−) Despesas Fixas',fmtVal(tFix)],
    ['(−) Despesas Variáveis',fmtVal(tVar)],
    ['(=) Resultado Líquido',fmtVal(tR-tD)],
    ['Taxa de Poupança',txPoup],
  ],styles:{fontSize:9,cellPadding:3},headStyles:{fillColor:[91,140,255],textColor:255,fontStyle:'bold'},
  alternateRowStyles:{fillColor:[245,246,250]},columnStyles:{1:{halign:'right'}},margin:{left:M,right:M}});
  y=doc.lastAutoTable.finalY+10;

  // Receitas e Despesas por mês
  var meses = [...new Set(todas.map(l=>(l.data||'').slice(0,7)).filter(Boolean))].sort().reverse().slice(0,6);
  if (meses.length>0){
    if(y>230){doc.addPage();y=M;}
    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(30,35,54);
    doc.text('RECEITAS & DESPESAS POR MÊS',M,y);y+=4;
    doc.setDrawColor(91,140,255);doc.line(M,y,W-M,y);y+=3;
    var rows=meses.reverse().map(m=>{var[yr,mo]=m.split('-');var r=todas.filter(l=>l.tipo==='credito'&&(l.data||'').startsWith(m)).reduce((s,l)=>s+l.valor,0);var d=todas.filter(l=>l.tipo==='debito'&&(l.data||'').startsWith(m)).reduce((s,l)=>s+l.valor,0);return[mo+'/'+yr,fmtVal(r),fmtVal(d),fmtVal(r-d)];});
    doc.autoTable({startY:y,head:[['Mês','Receitas','Despesas','Resultado']],body:rows,styles:{fontSize:9,cellPadding:3},headStyles:{fillColor:[91,140,255],textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[245,246,250]},columnStyles:{0:{cellWidth:30},1:{halign:'right'},2:{halign:'right'},3:{halign:'right'}},margin:{left:M,right:M}});
    y=doc.lastAutoTable.finalY+10;
  }

  // Cartão de crédito
  var cartao=c.cartao||[];
  if(cartao.length>0){
    if(y>230){doc.addPage();y=M;}
    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(30,35,54);
    doc.text('LANÇAMENTOS DO CARTÃO (últimos 50)',M,y);y+=4;
    doc.setDrawColor(255,198,107);doc.line(M,y,W-M,y);y+=3;
    var ccRows=[...cartao].sort((a,b)=>(b.data||'').localeCompare(a.data||'')).slice(0,50).map(it=>{var cc=(c.cartoes||[]).find(x=>x.id===it.cartaoId);return[it.data?it.data.split('-').reverse().join('/'):'—',cc?cc.nome:'—',it.desc,it.cat||'—',it.tipo==='estorno'?'Estorno':'Lançamento',fmtVal(it.valor)];});
    doc.autoTable({startY:y,head:[['Data','Cartão','Descrição','Categoria','Tipo','Valor']],body:ccRows,styles:{fontSize:8,cellPadding:2.5},headStyles:{fillColor:[255,198,107],textColor:[30,35,54],fontStyle:'bold'},alternateRowStyles:{fillColor:[245,246,250]},columnStyles:{5:{halign:'right'}},margin:{left:M,right:M}});
    y=doc.lastAutoTable.finalY+10;
  }

  // Conta corrente
  var extrato=c.extrato||[];
  if(extrato.length>0){
    if(y>230){doc.addPage();y=M;}
    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(30,35,54);
    doc.text('CONTA CORRENTE (últimos 50)',M,y);y+=4;
    doc.setDrawColor(62,207,176);doc.line(M,y,W-M,y);y+=3;
    var exRows=[...extrato].sort((a,b)=>(b.data||'').localeCompare(a.data||'')).slice(0,50).map(l=>[l.data?l.data.split('-').reverse().join('/'):'—',l.desc,l.cat||'—',l.tipo==='credito'?'Receita':'Despesa',fmtVal(l.valor)]);
    doc.autoTable({startY:y,head:[['Data','Descrição','Categoria','Tipo','Valor']],body:exRows,styles:{fontSize:8,cellPadding:2.5},headStyles:{fillColor:[62,207,176],textColor:[30,35,54],fontStyle:'bold'},alternateRowStyles:{fillColor:[245,246,250]},columnStyles:{4:{halign:'right'}},margin:{left:M,right:M}});
  }

  // Rodapé
  var pages=doc.internal.getNumberOfPages();
  for(var p=1;p<=pages;p++){
    doc.setPage(p);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(150,155,170);
    doc.text('Granafy — '+c.name+' — '+hoje,M,295);
    doc.setFont('helvetica','italic');doc.text('Desenvolvido por Levy Lima - Teste Beta Granafy',W/2,295,{align:'center'});
    doc.setFont('helvetica','normal');doc.text('Página '+p+'/'+pages,W-M,295,{align:'right'});
  }
  doc.save('granafy_relatorio_'+c.name.toLowerCase().replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.pdf');
}
