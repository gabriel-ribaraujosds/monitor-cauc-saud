/**
 * Gatilho de publicação do Monitor CAUC Saúde.
 *
 * O agendador do GitHub trata execuções `schedule` como melhor esforço e vinha
 * atrasando de 2 a 5 horas, o que tirava o painel do ar pela manhã. Este Worker
 * usa o Cron Trigger do Cloudflare, que dispara no horário, e aciona a mesma
 * Action por `workflow_dispatch` — execuções disparadas não passam pela fila de
 * agendamento e começam de imediato.
 *
 * Não expõe nenhum endpoint HTTP: só o handler `scheduled` existe, e
 * `workers_dev = false` no wrangler.toml impede que ganhe URL pública. Um
 * gatilho de publicação acessível pela internet seria convite a abuso.
 */

async function dispararPublicacao(env) {
  if (!env.GITHUB_TOKEN) {
    throw new Error('Segredo GITHUB_TOKEN ausente no Worker — o gatilho não tem como autenticar.');
  }

  const url = `https://api.github.com/repos/${env.REPOSITORIO}/actions/workflows/${env.WORKFLOW}/dispatches`;
  const resposta = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'monitor-cauc-gatilho',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: env.REFERENCIA }),
  });

  // O GitHub responde 204 sem corpo quando aceita o disparo.
  if (resposta.status !== 204) {
    const corpo = await resposta.text();
    throw new Error(`GitHub respondeu ${resposta.status}: ${corpo.slice(0, 300)}`);
  }

  console.log(`workflow_dispatch aceito para ${env.REPOSITORIO} (${env.WORKFLOW}).`);
}

export default {
  async scheduled(evento, env, contexto) {
    contexto.waitUntil(
      dispararPublicacao(env).catch((erro) => {
        // O erro fica no log do Worker; a rede de segurança contra falha
        // silenciosa é o workflow "Verificar se a publicação está em dia",
        // que avisa por e-mail quando o site fica atrás da fonte.
        console.error('Falha ao disparar a publicação:', erro.message);
        throw erro;
      })
    );
  },
};
