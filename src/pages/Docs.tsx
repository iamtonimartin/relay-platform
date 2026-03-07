import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen, ChevronRight, ExternalLink, Terminal, Globe, MessageSquare,
  Instagram, Settings, Database, Inbox, Users, Zap, AlertTriangle,
} from 'lucide-react';

// ─── Section definitions ─────────────────────────────────────────────────────

const sections = [
  { id: 'overview',        label: 'Overview',                  icon: BookOpen },
  { id: 'assistants',      label: 'Assistants',                icon: MessageSquare },
  { id: 'knowledge',       label: 'Knowledge Base',            icon: Database },
  { id: 'widget',          label: 'Web Widget',                icon: Globe },
  { id: 'messenger',       label: 'Facebook Messenger',        icon: MessageSquare },
  { id: 'instagram',       label: 'Instagram Direct',          icon: Instagram },
  { id: 'stammer',         label: 'Migrating from Stammer',    icon: Zap },
  { id: 'inbox',           label: 'Inbox & Handoff',           icon: Inbox },
  { id: 'settings',        label: 'Settings & API Keys',       icon: Settings },
  { id: 'team',            label: 'Team Members',              icon: Users },
];

// ─── Reusable components ─────────────────────────────────────────────────────

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-slate-900 mb-1">{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-600 leading-relaxed mb-3">{children}</p>;
}

function Steps({ items }: { items: (string | React.ReactNode)[] }) {
  return (
    <ol className="space-y-2 mb-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm text-slate-600">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-xs font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-amber-800 leading-relaxed">{children}</p>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-teal-50 border border-teal-200 rounded-xl p-4 mb-4">
      <ChevronRight className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-teal-800 leading-relaxed">{children}</p>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <div className="bg-slate-900 rounded-xl p-4 mb-4 overflow-x-auto">
      <pre className="text-sm text-slate-100 font-mono whitespace-pre-wrap">{children}</pre>
    </div>
  );
}

function Divider() {
  return <hr className="border-slate-100 my-8" />;
}

// ─── Section content ─────────────────────────────────────────────────────────

function SectionOverview() {
  return (
    <div>
      <H2>Overview</H2>
      <p className="text-sm text-slate-500 mb-6">What Relay is and how it works.</p>

      <P>
        Relay is a fully owned AI chatbot management platform. It lets you create, train and deploy
        AI-powered chat assistants across your website and social channels — without paying ongoing
        platform subscriptions.
      </P>

      <H3>Key concepts</H3>
      <div className="space-y-3 mb-6">
        {[
          { term: 'Assistant', def: 'An AI agent with its own name, personality, knowledge base and channel connections. You can have multiple assistants for different purposes.' },
          { term: 'Knowledge Base', def: 'The documents, URLs and Q&A pairs that an assistant learns from. The AI searches this when answering questions.' },
          { term: 'Channel', def: 'Where the assistant is deployed — your website widget, Facebook Messenger or Instagram Direct.' },
          { term: 'Inbox', def: 'The conversation log. Every chat that comes in appears here. You can take over any conversation and reply as a human agent.' },
          { term: 'Handoff', def: 'When a conversation is escalated from the AI to a human. This can be triggered by a keyword, sentiment, or the user asking for a person.' },
        ].map(({ term, def }) => (
          <div key={term} className="flex gap-3 text-sm">
            <span className="font-semibold text-slate-800 w-32 flex-shrink-0">{term}</span>
            <span className="text-slate-600 leading-relaxed">{def}</span>
          </div>
        ))}
      </div>

      <H3>How a conversation works</H3>
      <Steps items={[
        'A visitor sends a message via the widget, Messenger or Instagram.',
        'Relay searches the assistant\'s knowledge base for relevant context.',
        'The AI model generates a response using that context plus the system prompt.',
        'If a handoff trigger is matched, the conversation is flagged in the Inbox.',
        'A human agent can take over and reply directly.',
      ]} />
    </div>
  );
}

function SectionAssistants() {
  return (
    <div>
      <H2>Assistants</H2>
      <p className="text-sm text-slate-500 mb-6">Creating and configuring your AI assistants.</p>

      <H3>Creating an assistant</H3>
      <Steps items={[
        'Click "New Assistant" in the top right, or go to Assistants and click "Create New Assistant".',
        'Give it a name (internal reference) and a short purpose description.',
        'Select a model provider and model. Claude Sonnet 4.6 is recommended for most use cases.',
        'Click "Create Assistant" — you\'ll land on the settings page.',
      ]} />

      <H3>Settings tabs</H3>
      <div className="space-y-2 mb-6">
        {[
          { tab: 'General', desc: 'Name, purpose, welcome message and system prompt.' },
          { tab: 'Knowledge Base', desc: 'Upload files, scrape URLs, add Q&A pairs and text blocks.' },
          { tab: 'Model Settings', desc: 'Provider, model, API key override, temperature and max tokens.' },
          { tab: 'Preview', desc: 'Test the assistant in a live chat window before going live.' },
          { tab: 'Analytics', desc: 'Per-assistant metrics — conversations, handoff rate, top questions.' },
          { tab: 'Channels', desc: 'Connect and configure website widget, Messenger and Instagram.' },
          { tab: 'Hours of Operation', desc: 'Set active hours and an offline message for outside those times.' },
          { tab: 'Handoff Rules', desc: 'Configure trigger phrases and the handoff message.' },
          { tab: 'Lead Capture', desc: 'Enable a pre-chat form to collect name, email and phone.' },
          { tab: 'Quick Replies', desc: 'Add suggestion buttons that appear at conversation start.' },
          { tab: 'Appearance', desc: 'Display name, colour, widget position and avatar.' },
        ].map(({ tab, desc }) => (
          <div key={tab} className="flex gap-3 text-sm bg-slate-50 rounded-lg px-4 py-2.5">
            <span className="font-medium text-slate-800 w-40 flex-shrink-0">{tab}</span>
            <span className="text-slate-600">{desc}</span>
          </div>
        ))}
      </div>

      <H3>System prompt tips</H3>
      <P>
        The system prompt tells the AI who it is and how to behave. Lines starting with{' '}
        <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">//</code> are
        comments and are stripped before being sent to the model — use them as notes to yourself.
      </P>
      <Tip>
        Keep the system prompt focused. Tell it the business name, what it should and shouldn't answer,
        and the tone to use. The knowledge base handles the facts — the system prompt handles the personality.
      </Tip>
    </div>
  );
}

function SectionKnowledge() {
  return (
    <div>
      <H2>Knowledge Base</H2>
      <p className="text-sm text-slate-500 mb-6">Training your assistant on your content.</p>

      <P>
        The knowledge base is how the assistant knows about your business. When a user asks a question,
        Relay searches the knowledge base for relevant content and passes it to the AI as context.
      </P>

      <H3>Adding content</H3>
      <div className="space-y-3 mb-6">
        {[
          { type: 'File upload', desc: 'PDF, Word (.docx), CSV and TXT files. Text is extracted and indexed automatically.' },
          { type: 'URL scrape', desc: 'Paste a URL and Relay will fetch and index the page content. Good for services pages, FAQs and pricing pages.' },
          { type: 'Q&A pairs', desc: 'Write a question and its ideal answer. Best for specific FAQs where you want an exact response.' },
          { type: 'Text blocks', desc: 'Free-form text content. Useful for pasting in copy that isn\'t a document or URL.' },
        ].map(({ type, desc }) => (
          <div key={type} className="text-sm">
            <span className="font-semibold text-slate-800">{type} — </span>
            <span className="text-slate-600">{desc}</span>
          </div>
        ))}
      </div>

      <H3>How retrieval works</H3>
      <P>
        When a message comes in, Relay converts it to an embedding (a numerical representation of meaning)
        and searches the knowledge base for the most semantically similar entries. The top matches are
        injected into the AI's context before it responds.
      </P>
      <Note>
        Embeddings require an OpenAI API key. If no OpenAI key is set, Relay falls back to injecting
        the full knowledge base as plain text — this still works but is less precise and uses more tokens.
      </Note>

      <H3>Best practices</H3>
      <Steps items={[
        'Scrape your main website pages first — services, about, pricing, FAQs.',
        'Add a Q&A entry for every question you get asked repeatedly.',
        'Keep entries focused — one topic per entry works better than long documents.',
        'After adding content, test immediately in the Preview tab.',
      ]} />
    </div>
  );
}

function SectionWidget() {
  return (
    <div>
      <H2>Web Widget</H2>
      <p className="text-sm text-slate-500 mb-6">Embedding the chat widget on your website.</p>

      <H3>Getting the embed code</H3>
      <Steps items={[
        'Go to your assistant\'s settings page.',
        'Click the "Channels" tab.',
        'Copy the embed code from the "Website Widget" section.',
        'Paste it before the closing </body> tag on any page you want the widget to appear.',
      ]} />

      <H3>Example embed code</H3>
      <Code>{`<script>
  window.RelayConfig = { assistantId: "your-assistant-id" };
</script>
<script src="https://your-domain.com/widget.js" async></script>`}</Code>

      <H3>Appearance settings</H3>
      <P>
        Control the widget's look in the Appearance tab. You can set a display name (what users see
        in the chat header), a primary colour, the widget position (bottom right or bottom left)
        and upload an avatar or logo.
      </P>

      <H3>Lead capture</H3>
      <P>
        Enable the pre-chat form in the Lead Capture tab to collect a visitor's name, email or phone
        before the conversation starts. Each field can be marked as required or optional.
      </P>

      <H3>Offline hours</H3>
      <P>
        Set active hours in the Hours of Operation tab. Outside those hours, the widget shows your
        offline message and a contact form instead of the chat interface.
      </P>
    </div>
  );
}

function SectionMessenger() {
  return (
    <div>
      <H2>Facebook Messenger</H2>
      <p className="text-sm text-slate-500 mb-6">Connecting your Facebook Page to an assistant.</p>

      <Note>
        You need a Meta Developer account and a Facebook App with the Messenger product added.
        Your app must have the <strong>pages_messaging</strong> permission approved via App Review
        before real users (other than Page admins) can interact with the bot.
      </Note>

      <H3>Prerequisites</H3>
      <Steps items={[
        'A Facebook Page for your business.',
        'A Meta Developer account (developers.facebook.com).',
        'A Meta App with the "Messenger" product added.',
        'pages_messaging permission approved (or in Development Mode for testing).',
        'Your Meta App ID and App Secret — found in App Dashboard > App Settings > Basic.',
      ]} />

      <H3>Setup in Relay</H3>
      <Steps items={[
        'Go to Settings > API Keys and enter your Meta App ID and Meta App Secret. Save.',
        'Go to your assistant\'s Channels tab and click "Connect" under Facebook Messenger.',
        'Authorise the connection and select your Facebook Page.',
        'In Meta Developer Dashboard, go to Messenger > Settings.',
        <>Set the Webhook URL to: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">https://your-domain.com/api/webhooks/meta</code></>,
        'Set the Verify Token to match what\'s shown in Settings > API Keys under "Meta Verify Token".',
        'Subscribe the webhook to the "messages" field for your Page.',
      ]} />

      <H3>Testing</H3>
      <P>
        In Development Mode, only people listed as Developers or Testers on your Meta App can send
        messages to the bot. Add yourself and any testers in App Dashboard {'>'} Roles.
      </P>
    </div>
  );
}

function SectionInstagram() {
  return (
    <div>
      <H2>Instagram Direct</H2>
      <p className="text-sm text-slate-500 mb-6">Connecting an Instagram Professional account to an assistant.</p>

      <Note>
        Instagram uses a separate OAuth flow from Facebook Messenger. You need a dedicated
        Instagram App ID and Instagram App Secret from the "Instagram" use case in your Meta App —
        these are different from your Facebook App ID and Secret.
      </Note>

      <H3>Prerequisites</H3>
      <Steps items={[
        'An Instagram Professional account (Business or Creator) linked to your Facebook Page.',
        'A Meta Developer App with the "Instagram" use case added.',
        'instagram_business_manage_messages permission approved (or in Development Mode).',
        'Your Instagram App ID and Instagram App Secret from the Meta App\'s Instagram use case settings.',
      ]} />

      <H3>Finding your Instagram App ID and Secret</H3>
      <Steps items={[
        'Go to your Meta App in Meta Developer Dashboard.',
        'In the left menu, find the "Instagram" use case and click "Customise".',
        'Go to "API setup with Instagram login".',
        'Your Instagram App ID and Secret are shown here — they differ from the main App credentials.',
      ]} />

      <H3>Setup in Relay</H3>
      <Steps items={[
        'Go to Settings > API Keys. Enter the Instagram App ID and Instagram App Secret. Save.',
        'Register the OAuth redirect URI in Meta App > Instagram use case > API setup with Instagram login > "Add or remove redirect URIs". Add: https://your-domain.com/api/auth/meta/callback',
        'Go to your assistant\'s Channels tab and click "Connect" under Instagram Direct.',
        'Authorise the connection — Relay will subscribe your account to receive direct messages automatically.',
        <>In Meta Developer Dashboard, set the Instagram webhook URL to: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">https://your-domain.com/api/webhooks/meta</code></>,
        'Set the Verify Token to match the value in Settings > API Keys under "Meta Verify Token".',
        'Subscribe the webhook to the "messages" field.',
      ]} />
    </div>
  );
}

function SectionStammer() {
  return (
    <div>
      <H2>Migrating from Stammer</H2>
      <p className="text-sm text-slate-500 mb-6">
        If you are already live on Stammer with Messenger and/or Instagram connected, migration to
        Relay does not require a new App Review. Your existing Meta App approval carries over — you
        just need to update the webhook URL and reconnect via OAuth.
      </p>

      <H3>What stays the same</H3>
      <P>
        Your Meta App, its App Review approvals, your Facebook Page and your Instagram account all
        remain unchanged. You are only changing where the webhook points and which platform holds
        the OAuth token.
      </P>

      <H3>Migration checklist</H3>

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 mb-6 space-y-3">
        {[
          'Deploy Relay and confirm it is live at your domain.',
          'Create your assistant in Relay and train it with your knowledge base content.',
          'Go to Settings > API Keys and enter your existing Meta App ID, App Secret, Instagram App ID and Instagram App Secret.',
          'Update the Webhook URL in your Meta App to point at your Relay domain instead of Stammer.',
          'The Verify Token in Meta must match the value shown in Relay Settings > API Keys. Update it if needed.',
          'In Relay, go to your assistant\'s Channels tab and reconnect Facebook Messenger via OAuth — this gives Relay a fresh access token for your Page.',
          'Do the same for Instagram Direct.',
          'Send a test message from a personal account to confirm messages arrive in the Relay Inbox.',
          'Once confirmed, you can safely disconnect from Stammer.',
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 accent-teal-600 flex-shrink-0" readOnly />
            <span className="text-slate-700 leading-relaxed">{item}</span>
          </div>
        ))}
      </div>

      <Note>
        Do not disconnect from Stammer until you have confirmed messages are arriving correctly
        in Relay. Run both in parallel briefly during the handover.
      </Note>

      <H3>Re-training the knowledge base</H3>
      <P>
        Your Stammer knowledge base content does not migrate automatically. You will need to
        re-add it in Relay. The quickest approach is to scrape your main website pages via the
        URL scrape tool, then add any custom Q&A pairs manually.
      </P>

      <H3>Webhook URL format</H3>
      <P>Both Facebook Messenger and Instagram use the same webhook endpoint in Relay:</P>
      <Code>{`https://your-relay-domain.com/api/webhooks/meta`}</Code>
    </div>
  );
}

function SectionInbox() {
  return (
    <div>
      <H2>Inbox & Handoff</H2>
      <p className="text-sm text-slate-500 mb-6">Managing conversations and taking over from the AI.</p>

      <H3>Conversation statuses</H3>
      <div className="space-y-2 mb-6">
        {[
          { status: 'Active', colour: 'bg-emerald-100 text-emerald-700', desc: 'The AI is handling the conversation.' },
          { status: 'Handed off', colour: 'bg-amber-100 text-amber-700', desc: 'The conversation has been escalated to a human agent.' },
          { status: 'Closed', colour: 'bg-slate-100 text-slate-500', desc: 'The conversation has been marked as resolved.' },
          { status: 'Archived', colour: 'bg-slate-100 text-slate-400', desc: 'Hidden from the main inbox. Accessible via the Archived filter.' },
        ].map(({ status, colour, desc }) => (
          <div key={status} className="flex items-center gap-3 text-sm">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${colour} w-24 text-center flex-shrink-0`}>{status}</span>
            <span className="text-slate-600">{desc}</span>
          </div>
        ))}
      </div>

      <H3>Taking over a conversation</H3>
      <Steps items={[
        'Open the conversation in the Inbox.',
        'Click "Take Over" — this pauses the AI and enables your reply input.',
        'Type and send your message. It appears in the chat with an "Agent" label.',
        'Click "Close" when the conversation is resolved.',
      ]} />

      <H3>Handoff triggers</H3>
      <P>
        Handoff is triggered automatically when any of the following occur:
      </P>
      <Steps items={[
        'The user types a trigger phrase (e.g. "speak to a human", "call me").',
        'The AI fails to answer a configurable number of times in a row.',
        'Configure trigger phrases and the fallback count in the assistant\'s Handoff Rules tab.',
      ]} />

      <H3>Notifications</H3>
      <P>
        When a handoff is triggered, Relay can send an email notification. Configure the recipient
        address in Settings {'>'} Notifications.
      </P>

      <H3>Tags</H3>
      <P>
        Tag conversations for review or follow-up. Tags appear in the conversation list and can be
        filtered. Click "+ Add tag" in the conversation header to add one.
      </P>
    </div>
  );
}

function SectionSettings() {
  return (
    <div>
      <H2>Settings & API Keys</H2>
      <p className="text-sm text-slate-500 mb-6">Configuring the platform and connecting AI providers.</p>

      <H3>API Keys</H3>
      <P>
        Global API keys are set here and used as defaults for all assistants. You can override
        the key per assistant in the assistant's Model Settings tab.
      </P>
      <div className="space-y-2 mb-6">
        {[
          { key: 'Anthropic', note: 'Required for Claude models. Get from console.anthropic.com.' },
          { key: 'OpenAI', note: 'Required for GPT models and knowledge base embeddings (text-embedding-3-small).' },
          { key: 'Google', note: 'Required for Gemini models.' },
          { key: 'xAI', note: 'Required for Grok models.' },
          { key: 'Meta App ID / Secret', note: 'For Facebook Messenger. Found in Meta App > App Settings > Basic.' },
          { key: 'Instagram App ID / Secret', note: 'For Instagram Direct. Found in Meta App > Instagram use case settings. Different from the Meta App credentials.' },
          { key: 'Meta Verify Token', note: 'Auto-generated. Used to verify webhook calls from Meta. Copy this into your Meta App webhook configuration.' },
        ].map(({ key, note }) => (
          <div key={key} className="text-sm bg-slate-50 rounded-lg px-4 py-2.5">
            <span className="font-medium text-slate-800">{key}</span>
            <span className="text-slate-500"> — {note}</span>
          </div>
        ))}
      </div>

      <H3>Notifications</H3>
      <P>
        Set a notification email address to receive alerts when a handoff is triggered or a new
        lead is captured. Configure your SMTP settings here if using a custom email server.
      </P>

      <H3>Security</H3>
      <P>
        Change your login password in Settings {'>'} Security. You can also configure session timeout
        duration here.
      </P>

      <H3>Data & GDPR</H3>
      <P>
        Set a conversation retention period (30, 60 or 90 days). Export all platform data as CSV.
        Delete all conversations if needed.
      </P>
    </div>
  );
}

function SectionTeam() {
  return (
    <div>
      <H2>Team Members</H2>
      <p className="text-sm text-slate-500 mb-6">Adding additional users to the platform.</p>

      <P>
        Relay supports multiple users. The initial account is the Admin. Additional team members
        can be invited with Member access.
      </P>

      <H3>Adding a team member</H3>
      <Steps items={[
        'Go to Settings > Team.',
        'Enter the new user\'s email address and a temporary password.',
        'Click "Add Member".',
        'Share the login URL and credentials with them.',
        'They can change their password after logging in via Settings > Security.',
      ]} />

      <H3>Roles</H3>
      <div className="space-y-2 mb-4">
        {[
          { role: 'Admin', desc: 'Full access to all settings, assistants and team management.' },
          { role: 'Member', desc: 'Access to Inbox and Assistants. Cannot modify Settings or manage team.' },
        ].map(({ role, desc }) => (
          <div key={role} className="flex gap-3 text-sm bg-slate-50 rounded-lg px-4 py-2.5">
            <span className="font-medium text-slate-800 w-20 flex-shrink-0">{role}</span>
            <span className="text-slate-600">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const sectionContent: Record<string, React.ReactNode> = {
  overview:   <SectionOverview />,
  assistants: <SectionAssistants />,
  knowledge:  <SectionKnowledge />,
  widget:     <SectionWidget />,
  messenger:  <SectionMessenger />,
  instagram:  <SectionInstagram />,
  stammer:    <SectionStammer />,
  inbox:      <SectionInbox />,
  settings:   <SectionSettings />,
  team:       <SectionTeam />,
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function Docs() {
  const [active, setActive] = useState('overview');
  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll content to top when section changes
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [active]);

  const activeSection = sections.find(s => s.id === active);

  return (
    <div className="flex gap-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 9rem)' }}>

      {/* Sidebar nav */}
      <nav className="w-56 flex-shrink-0 border-r border-slate-100 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-bold text-slate-900">Documentation</span>
          </div>
        </div>
        <div className="flex-1 py-2">
          {sections.map(s => {
            const Icon = s.icon;
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left ${
                  isActive
                    ? 'bg-teal-50 text-teal-700 font-semibold border-r-2 border-teal-500'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="p-4 border-t border-slate-100">
          <a
            href="https://relay.ascendz.co"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Terminal className="w-3 h-3" />
            relay.ascendz.co
            <ExternalLink className="w-3 h-3 ml-auto" />
          </a>
        </div>
      </nav>

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl">
          {sectionContent[active]}
        </div>
      </div>
    </div>
  );
}
