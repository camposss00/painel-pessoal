import { db } from '../storage/db.js';
import { showToast, showConfirmModal } from '../utils/helpers.js';

export function initBackupModule() {
  const btnExport = document.getElementById('btn-export-data');
  const btnImport = document.getElementById('btn-import-data');
  const fileInput = document.getElementById('import-file-input');

  if (btnExport) {
    btnExport.addEventListener('click', handleExportData);
  }

  if (btnImport && fileInput) {
    btnImport.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleImportData);
  }
}

async function handleExportData() {
  try {
    const backupData = await db.backup.exportAll();
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const now = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = `painel_pessoal_backup_${now}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Backup exportado com sucesso!', 'success');
  } catch (e) {
    console.error(e);
    showToast('Erro ao exportar dados.', 'error');
  }
}

function handleImportData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (!parsed || !parsed.data) {
        showToast('Arquivo de backup inválido.', 'error');
        return;
      }

      showConfirmModal({
        title: 'Restaurar Backup',
        message: 'A importação mesclará/substituirá os dados atuais pelo arquivo selecionado. Deseja continuar?',
        confirmText: 'Importar',
        danger: false,
        onConfirm: async () => {
          await db.backup.importAll(parsed);
          showToast('Dados restaurados com sucesso! Atualizando...', 'success');
          setTimeout(() => {
            window.location.reload();
          }, 800);
        }
      });
    } catch (err) {
      console.error(err);
      showToast('Erro ao ler o arquivo JSON selecionado.', 'error');
    } finally {
      e.target.value = ''; // Reset input
    }
  };

  reader.readAsText(file);
}
