/* WinFast · configuração da integração de vídeos dos arremessos
 *
 * Os vídeos são lidos da pasta do OneDrive sincronizada no computador (Chrome/Edge): na aba Jogador,
 * clique em "Selecionar pasta de vídeos" e escolha a pasta raiz (ex.: BASQUETE). Nada é configurado
 * aqui sobre o caminho e nenhum dado sai do computador. Veja VIDEO_SETUP.md. */
window.WF_VIDEO_CONFIG = {
  // Apelidos do app de timeline → nome do atleta no site (use quando não forem iguais).
  // Ex.: { 'Leozão': 'Leonardo S.' }
  athleteAliases: {},

  quarterSeconds: 600      // duração do quarto no relógio do scout (para a checagem de sequência)
};
