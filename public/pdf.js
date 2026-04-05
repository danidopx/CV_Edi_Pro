import { getValSafe } from './ui.js';

export function gerarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setLineHeightFactor(1.4);
    const margin = 20;
    let y = 20;
    const regexClean = /\[editar\]|\[remover\]|\[x\]/g;
    function checarQuebra(espaco) {
        if (y + espaco > 280) {
            doc.addPage();
            y = 20;
        }
    }
    const nome = getValSafe('inNome') || 'Candidato';
    const arquivo = `CV_${nome.replace(/\s+/g, '_')}.pdf`;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(30, 30, 30);
    checarQuebra(15);
    const nomePrev = document.getElementById('nomePreview');
    doc.text(nomePrev ? nomePrev.innerText : '', 105, y, { align: 'center' });
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    checarQuebra(10);
    const contatoP = document.getElementById('contatoPreview');
    const contatoTxt = contatoP ? contatoP.innerText : '';
    const linhasContato = doc.splitTextToSize(contatoTxt, 170);
    doc.text(linhasContato, 105, y, { align: 'center' });
    y += (linhasContato.length * 5) + 3;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, 190, y);
    y += 10;

    const secoes = [
        { t: 'RESUMO PROFISSIONAL', id: 'preRes', type: 'text' },
        { t: 'EXPERIÊNCIA PROFISSIONAL', id: 'preExp', type: 'exp' },
        { t: 'FORMAÇÃO ACADÊMICA', id: 'preEsc', type: 'list' },
        { t: 'IDIOMAS', id: 'preIdi', type: 'list' },
        { t: 'HABILIDADES', id: 'preHab', type: 'grid' }
    ];

    secoes.forEach(s => {
        const el = document.getElementById(s.id);
        if (!el || el.innerHTML.trim() === '') return;
        checarQuebra(18);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(30, 30, 30);
        doc.text(s.t, margin, y);
        y += 2.5;
        doc.setDrawColor(30, 30, 30);
        doc.setLineWidth(0.6);
        doc.line(margin, y, 190, y);
        y += 7;
        doc.setLineWidth(0.2);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);

        if (s.type === 'text') {
            Array.from(el.querySelectorAll('.texto-justificado')).forEach(it => {
                const txt = it.innerText.replace(regexClean, '').trim();
                const dim = doc.getTextDimensions(txt, { maxWidth: 170 });
                checarQuebra(dim.h + 5);
                doc.text(txt, margin, y, { maxWidth: 170, align: 'justify' });
                y += dim.h + 4;
            });
        } else if (s.type === 'exp') {
            Array.from(el.querySelectorAll('.bloco-exp')).forEach(b => {
                const cargo = b.querySelector('.exp-header span:first-child').innerText;
                const periodo = b.querySelector('.exp-header span:last-child').innerText;
                const emp = b.querySelector('.exp-empresa').innerText;
                const desc = b.querySelector('.texto-justificado').innerText.replace(regexClean, '').trim();
                const dim = doc.getTextDimensions(desc, { maxWidth: 170 });
                checarQuebra(dim.h + 16);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(30, 30, 30);
                doc.text(cargo, margin, y);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 100, 100);
                doc.text(periodo, 190, y, { align: 'right' });
                y += 5.5;
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(80, 80, 80);
                doc.text(emp, margin, y);
                y += 5.5;
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(50, 50, 50);
                doc.text(desc, margin, y, { maxWidth: 170, align: 'left' });
                y += dim.h + 7;
            });
        } else if (s.type === 'list') {
            Array.from(el.querySelectorAll('.item-lista')).forEach(it => {
                checarQuebra(8);
                doc.text(it.innerText.replace(regexClean, '').trim(), margin, y);
                y += 6;
            });
        } else if (s.type === 'grid') {
            const habs = Array.from(el.querySelectorAll('.item-lista')).map(elItem =>
                elItem.querySelector('.hab-text') ? elItem.querySelector('.hab-text').innerText.replace(regexClean, '').trim() : ''
            );
            const habString = habs.filter(h => h).join('   •   ');
            const linhasHab = doc.splitTextToSize(habString, 170);
            checarQuebra((linhasHab.length * 5) + 5);
            doc.text(linhasHab, margin, y, { align: 'left' });
            y += (linhasHab.length * 5) + 5;
        }
        y += 7;
    });
    doc.save(arquivo);
}
