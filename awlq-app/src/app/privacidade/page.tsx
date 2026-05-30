import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politica de Privacidade",
  description: "Como a AWS Quest coleta, usa e protege seus dados pessoais.",
};

export default function PrivacidadePage() {
  return (
    <div className="pixel-shell mx-auto max-w-2xl px-4 py-12 font-sans text-sm text-[var(--pixel-text)]">
      <h1 className="mb-6 font-mono text-base uppercase text-[var(--pixel-primary)]">
        Politica de Privacidade
      </h1>

      <p className="mb-4 text-[var(--pixel-subtext)]">
        Ultima atualizacao: maio de 2026
      </p>

      <section className="mb-6 space-y-3">
        <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">1. Dados coletados</h2>
        <p>
          Coletamos os seguintes dados pessoais ao criar e usar sua conta:
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Nome de exibicao e nome de usuario (username)</li>
          <li>Endereco de e-mail</li>
          <li>Imagem de avatar (opcional, enviada pelo usuario)</li>
          <li>Historico de sessoes de estudo e labs completos</li>
          <li>Pontuacao (XP), badges e conquistas</li>
          <li>Preferencias de certificacao e tema</li>
          <li>Dados de sessao (IP, user-agent) para fins de seguranca</li>
        </ul>
      </section>

      <section className="mb-6 space-y-3">
        <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">2. Finalidade e bases legais</h2>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>Execucao de contrato (LGPD, Art. 7, V):</strong> criacao de conta,
            autenticacao, armazenamento de historico de estudo e labs.
          </li>
          <li>
            <strong>Legitimo interesse (LGPD, Art. 7, IX):</strong> gamificacao, ranking,
            envio de e-mails de engajamento (com opcao de descadastro) e melhoria continua da plataforma.
          </li>
          <li>
            <strong>Consentimento (LGPD, Art. 7, I):</strong> para menores entre 16 e 18 anos
            (requer consentimento dos responsaveis — a plataforma e destinada a maiores de 18 anos).
          </li>
        </ul>
      </section>

      <section className="mb-6 space-y-3">
        <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">3. Retencao de dados</h2>
        <p>
          Seus dados sao retidos enquanto sua conta estiver ativa. Apos solicitacao de exclusao, os dados
          pessoais sao anonimizados. Adicionalmente:
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Contas rejeitadas sao anonimizadas apos 90 dias da decisao.</li>
          <li>Contas pendentes sao anonimizadas apos 180 dias sem atividade.</li>
          <li>Historicos de sessao de estudo sao anonimizados apos 3 anos.</li>
        </ul>
      </section>

      <section className="mb-6 space-y-3">
        <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">4. Compartilhamento de dados</h2>
        <p>Seus dados podem ser processados pelos seguintes terceiros:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>Google / Gemini AI:</strong> geracao de questoes de estudo. Nenhum dado pessoal
            identificavel e enviado; apenas textos de contexto tecnico.
          </li>
          <li>
            <strong>Supabase:</strong> armazenamento de arquivos (avatars, badges) em infraestrutura
            de nuvem com sede nos EUA.
          </li>
          <li>
            <strong>Gmail SMTP (Google Workspace):</strong> entrega de e-mails transacionais e
            de engajamento.
          </li>
        </ul>
        <p>
          Nao vendemos nem compartilhamos seus dados com terceiros para fins publicitarios.
        </p>
      </section>

      <section className="mb-6 space-y-3">
        <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">5. Transferencia internacional</h2>
        <p>
          Alguns prestadores de servico (Google, Supabase) operam servidores fora do Brasil. Quando
          dados sao transferidos internacionalmente, exigimos garantias contratuais adequadas conforme
          a LGPD (Art. 33).
        </p>
      </section>

      <section className="mb-6 space-y-3">
        <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">6. Seus direitos (LGPD, Art. 18)</h2>
        <p>Voce tem direito de:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Confirmar se tratamos seus dados;</li>
          <li>Acessar seus dados (disponivel em: Perfil &gt; Privacidade &gt; Exportar meus dados);</li>
          <li>Corrigir dados incompletos ou inexatos (disponivel em: Perfil &gt; Editar);</li>
          <li>Solicitar anonimizacao ou exclusao (disponivel em: Perfil &gt; Privacidade &gt; Excluir minha conta);</li>
          <li>Portabilidade dos dados em formato JSON;</li>
          <li>Revogar consentimento a qualquer momento;</li>
          <li>Opor-se ao tratamento baseado em legitimo interesse.</li>
        </ul>
      </section>

      <section className="mb-6 space-y-3">
        <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">7. Contato — Encarregado de Dados (DPO)</h2>
        <p>
          Para exercer seus direitos ou tirar duvidas sobre o tratamento de dados:
        </p>
        <p>
          <a
            href="mailto:wallacesantanak0@gmail.com"
            className="font-semibold text-[var(--pixel-primary)] underline"
          >
            wallacesantanak0@gmail.com
          </a>
        </p>
      </section>

      <div className="mt-8 border-t-2 border-[var(--pixel-border)] pt-6 text-center">
        <Link href="/login" className="font-mono text-xs uppercase text-[var(--pixel-primary)] underline">
          Voltar ao login
        </Link>
      </div>
    </div>
  );
}
