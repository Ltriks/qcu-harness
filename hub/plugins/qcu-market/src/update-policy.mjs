const freezeUpdatePolicy=value=>{for(const child of Object.values(value))if(child&&typeof child==='object')freezeUpdatePolicy(child);return Object.freeze(value)}
// Fixed publisher key and frozen reviewed projections. No private key is shipped.
export const expertUpdatePolicy=freezeUpdatePolicy({
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA6lQ5mWtzfd5p6eGsv8UjKT0FDU76c/eRo4wyJKxprHs=\n-----END PUBLIC KEY-----\n",
  "products": {
    "qcu-study-coach": {
      "capability": "skill",
      "peers": {
        "@deepseek-ai/cordis": "4.0.4",
        "@deepseek-ai/dsh-skill": "0.2.0-rc.2"
      }
    },
    "qcu-lesson-planning": {
      "capability": "skill",
      "peers": {
        "@deepseek-ai/cordis": "4.0.4",
        "@deepseek-ai/dsh-skill": "0.2.0-rc.2",
        "@deepseek-ai/dsh-scope": "0.2.0-rc.2"
      }
    },
    "qcu-tiered-practice": {
      "capability": "skill",
      "peers": {
        "@deepseek-ai/cordis": "4.0.4",
        "@deepseek-ai/dsh-skill": "0.2.0-rc.2",
        "@deepseek-ai/dsh-scope": "0.2.0-rc.2"
      }
    },
    "qcu-note-organizer": {
      "capability": "skill",
      "peers": {
        "@deepseek-ai/cordis": "4.0.4",
        "@deepseek-ai/dsh-skill": "0.2.0-rc.2",
        "@deepseek-ai/dsh-scope": "0.2.0-rc.2"
      }
    },
    "qcu-reading-outline": {
      "capability": "skill",
      "peers": {
        "@deepseek-ai/cordis": "4.0.4",
        "@deepseek-ai/dsh-skill": "0.2.0-rc.2",
        "@deepseek-ai/dsh-scope": "0.2.0-rc.2"
      }
    },
    "qcu-integrity-guard": {
      "capability": "skill",
      "peers": {
        "@deepseek-ai/cordis": "4.0.4",
        "@deepseek-ai/dsh-skill": "0.2.0-rc.2",
        "@deepseek-ai/dsh-scope": "0.2.0-rc.2"
      }
    },
    "qcu-team-briefing": {
      "capability": "skill",
      "peers": {
        "@deepseek-ai/cordis": "4.0.4",
        "@deepseek-ai/dsh-skill": "0.2.0-rc.2",
        "@deepseek-ai/dsh-scope": "0.2.0-rc.2"
      }
    },
    "qcu-feishu-readonly": {
      "capability": "tools",
      "peers": {
        "@deepseek-ai/cordis": "4.0.4",
        "@deepseek-ai/cosmokit": "1.8.5",
        "@deepseek-ai/dsh-tools": "0.2.0-rc.2",
        "@deepseek-ai/schemastery": "3.18.4"
      }
    },
    "qcu-course-workbench": {
      "capability": "workbench",
      "peers": {
        "@deepseek-ai/cordis": "4.0.4",
        "@deepseek-ai/schemastery": "3.18.4",
        "@deepseek-ai/dsh-typert-protocol": "0.2.0-rc.2",
        "@deepseek-ai/dsh-typert-registry": "0.2.0-rc.2",
        "@deepseek-ai/dsh-api-remotes": "0.2.0-rc.2",
        "@deepseek-ai/dsh-llm": "0.2.0-rc.2",
        "@deepseek-ai/dsh-workspace": "0.2.0-rc.2",
        "@deepseek-ai/dsh-agent-default-model": "0.2.0-rc.2",
        "@deepseek-ai/dsh-skill": "0.2.0-rc.2",
        "@deepseek-ai/dsh-client-ui-layout": "0.2.0-rc.2",
        "@deepseek-ai/dsh-client-ui-sidebar": "0.2.0-rc.2"
      }
    },
    "qcu-expert-teams": {
      "capability": "tools",
      "peers": {
        "@deepseek-ai/cordis": "4.0.4",
        "@deepseek-ai/schemastery": "3.18.4",
        "@deepseek-ai/dsh-typert-protocol": "0.2.0-rc.2",
        "@deepseek-ai/dsh-typert-registry": "0.2.0-rc.2",
        "@deepseek-ai/dsh-api-remotes": "0.2.0-rc.2",
        "@deepseek-ai/dsh-llm": "0.2.0-rc.2",
        "@deepseek-ai/dsh-workspace": "0.2.0-rc.2",
        "@deepseek-ai/dsh-agent-default-model": "0.2.0-rc.2",
        "@deepseek-ai/dsh-skill": "0.2.0-rc.2",
        "@deepseek-ai/dsh-client-ui-layout": "0.2.0-rc.2",
        "@deepseek-ai/dsh-client-ui-sidebar": "0.2.0-rc.2"
      }
    },
    "qcu-market": {
      "capability": "market",
      "peers": {
        "@deepseek-ai/cordis": "4.0.4",
        "@deepseek-ai/dsh-client-ui-layout": "0.2.0-rc.2",
        "@deepseek-ai/dsh-client-ui-sidebar": "0.2.0-rc.2",
        "@deepseek-ai/dsh-plugin-manager": "0.2.0-rc.2",
        "@deepseek-ai/dsh-api-remotes": "0.2.0-rc.2",
        "@deepseek-ai/dsh-client-ui-plugin-manager": "0.2.0-rc.2",
        "@deepseek-ai/dsh-typert-registry": "0.2.0-rc.2",
        "@deepseek-ai/dsh-typert-protocol": "0.2.0-rc.2",
        "@deepseek-ai/dsh-app-boot": "0.2.0-rc.2"
      }
    }
  }
})

// Frozen P15.1 and P15.2 identities/peers must never expand with the default policy.
export const legacyUpdatePolicy=freezeUpdatePolicy({publicKey:expertUpdatePolicy.publicKey,products:Object.fromEntries(Object.entries(expertUpdatePolicy.products).filter(([id])=>id!=='qcu-expert-teams'))})

// P17.1: only this reviewed single-component plugin and its exact ten peers.
export const updatePolicy=freezeUpdatePolicy({publicKey:expertUpdatePolicy.publicKey,products:{...expertUpdatePolicy.products,"qcu-reading":{
  "capability": "tools",
  "peers": {
    "@deepseek-ai/cordis": "4.0.4",
    "@deepseek-ai/schemastery": "3.18.4",
    "@deepseek-ai/dsh-typert-protocol": "0.2.0-rc.2",
    "@deepseek-ai/dsh-typert-registry": "0.2.0-rc.2",
    "@deepseek-ai/dsh-api-remotes": "0.2.0-rc.2",
    "@deepseek-ai/dsh-llm": "0.2.0-rc.2",
    "@deepseek-ai/dsh-workspace": "0.2.0-rc.2",
    "@deepseek-ai/dsh-agent-default-model": "0.2.0-rc.2",
    "@deepseek-ai/dsh-client-ui-layout": "0.2.0-rc.2",
    "@deepseek-ai/dsh-client-ui-sidebar": "0.2.0-rc.2"
  }
}}})
