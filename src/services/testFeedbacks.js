const testarFeedbacks = async () => {
  const alunoId = "6827c8fc861946ce520cc883";
  
  // 1. Teste Semanal
  const semanal = await fetch('http://localhost:3000/api/feedback/semanal/' + alunoId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  console.log('Semanal:', await semanal.json());

  // 2. Teste Mensal
  const mensal = await fetch('http://localhost:3000/api/feedback/mensal/' + alunoId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  console.log('Mensal:', await mensal.json());

  // 3. Verificar no banco
  const registros = await fetch(`http://localhost:3000/api/feedback?alunoId=${alunoId}`);
  console.log('Todos feedbacks:', await registros.json());
};

testarFeedbacks().catch(console.error);