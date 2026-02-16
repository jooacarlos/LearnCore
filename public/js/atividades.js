document.addEventListener('DOMContentLoaded', function() {
    // Seleciona todos os cards de atividade
    const activityCards = document.querySelectorAll('.activity-card');
    
    // Adiciona evento de clique a cada card
    activityCards.forEach(card => {
      card.addEventListener('click', function() {
        // Obtém o ID da atividade
        const activityId = this.getAttribute('data-activity-id');
        
        // Redireciona para a página de detalhes com o ID da atividade
        window.location.href = `atividadeDetalhe.html?id=${activityId}`;
      });
      
      // Adiciona estilo de cursor pointer para indicar que é clicável
      card.style.cursor = 'pointer';
    });
  });