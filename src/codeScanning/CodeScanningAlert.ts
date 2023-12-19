/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
export interface Rule {
  id?: string | null
  severity?: string | null
  security_severity_level?: string
  description?: string
}

export interface CodeScanningData {
  number: number
  /**
   * The time that the alert was created in ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ`.
   */
  created_at: string
  /**
   * The REST API URL of the alert resource.
   */
  url: string
  /**
   * The GitHub URL of the alert resource.
   */
  html_url: string
  /**
   * State of a code scanning alert.
   */
  state: 'open' | 'dismissed' | 'fixed' | 'closed'
  dismissed_by: {
    login?: string
    id?: number
    node_id?: string
    avatar_url?: string
    gravatar_id: string | null
    url?: string
    html_url?: string
    followers_url?: string
    following_url?: string
    gists_url?: string
    starred_url?: string
    subscriptions_url?: string
    organizations_url?: string
    repos_url?: string
    events_url?: string
    received_events_url?: string
    type?: string
    site_admin?: boolean
    [k: string]: unknown
  } | null
  /**
   * The time that the alert was dismissed in ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ`.
   */
  dismissed_at: string | null
  /**
   * **Required when the state is dismissed.** The reason for dismissing or closing the alert. Can be one of: `false positive`, `won't fix`, and `used in tests`.
   */
  dismissed_reason: ('' | 'false positive' | "won't fix" | 'used in tests') | null
  rule: {
    /**
     * A unique identifier for the rule used to detect the alert.
     */
    id?: string | null
    /**
     * The severity of the alert.
     */
    severity?: 'none' | 'note' | 'warning' | 'error' | null
    /**
     * A short description of the rule used to detect the alert.
     */
    description?: string
  }
  tool: {
    /**
     * The name of the tool used to generate the code scanning analysis alert.
     */
    name?: string
    /**
     * The version of the tool used to detect the alert.
     */
    version?: string | null
  }
  most_recent_instance: {
    commit_sha?: string
    location?: {
      path?: string
      start_line?: number
      end_line?: number
      start_column?: number
      end_column?: number
    }
    message?: {
      text?: string
    }
  }
}

export interface AlertDismissal {
  at: string
  reason: '' | 'false positive' | 'won\'t fix' | 'used in tests' | null
  by?: {
    login?: string
    type?: string
    id?: number
  }
}
export interface AlertInstanceLocation {
  commitSHA?: string
  location?: {
    path: string
    startLine: number
    endLine: number
    startColumn: number
    endColumn: number
  }
  message?: string
}
export default class CodeScanningAlert {
  private readonly data: CodeScanningData

  constructor (data: CodeScanningData) {
    this.data = data
  }

  get id (): number {
    return this.data.number
  }

  get url (): string {
    return this.data.html_url
  }

  get created (): string {
    return this.data.created_at
  }

  get mostRecentInstance (): AlertInstanceLocation {
    const instanceLocation: AlertInstanceLocation = {
      commitSHA: this.data.most_recent_instance.commit_sha,
      location: {
        path: this.data.most_recent_instance.location?.path ?? '',
        startLine: this.data.most_recent_instance.location?.start_line ?? 0,
        endLine: this.data.most_recent_instance.location?.end_line ?? 0,
        startColumn: this.data.most_recent_instance.location?.start_column ?? 0,
        endColumn: this.data.most_recent_instance.location?.end_column ?? 0
      },
      message: this.data.most_recent_instance.message?.text?.replaceAll('\\n', '</br>') ?? ''
    }

    return instanceLocation
  }

  get dismissed (): AlertDismissal | null {
    if (!this.data.dismissed_at) {
      return null
    }

    const result: AlertDismissal = {
      at: this.data.dismissed_at,
      reason: this.data.dismissed_reason
    }

    if (this.data.dismissed_by) {
      result.by = {
        login: this.data.dismissed_by.login,
        type: this.data.dismissed_by.type,
        id: this.data.dismissed_by.id
        // TODO these were invalid
        // avatar: this._data.dismissed_at.avatar_url,
        // url: this._data.dismissed_at.html_url,
      }
    }

    return result
  }

  get severity (): string {
    // return this.rule ? this.rule.severity : null;
    return this.rule.security_severity_level ?? this.rule.severity ?? ''
  }

  get state (): string {
    return this.data.state
  }

  get rule (): Rule {
    return this.data.rule
  }

  get ruleId (): string {
    return this.rule.id ?? ''
  }

  get ruleDescription (): string {
    return this.rule.description ?? ''
  }

  get toolName (): string | null {
    return this.data.tool?.name ?? null
  }

  get toolVersion (): string | null {
    return this.data.tool?.version ?? null
  }
}
