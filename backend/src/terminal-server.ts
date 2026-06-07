import { spawn } from "child_process";
import AWS = require("aws-sdk");

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  sessionToken?: string;
  expiration?: Date;
}

/**
 * STS Credential Refresh Manager
 * Handles automatic refresh of temporary AWS credentials (ASIA keys)
 */
export class STSCredentialManager {
  private roleArn?: string;
  private roleSessionName?: string;
  private region: string;

  constructor(roleArn?: string, roleSessionName?: string, region: string = "ap-south-1") {
    this.roleArn = roleArn || process.env.AWS_MANAGEMENT_ACCOUNT_ROLE_ARN;
    this.roleSessionName = roleSessionName || `lab-session-${Date.now()}`;
    this.region = region;
  }

  /**
   * Check if credentials need refresh
   * Returns true if credentials are temporary (ASIA) and expired or about to expire
   */
  needsRefresh(credentials: AWSCredentials): boolean {
    if (!credentials.accessKeyId?.startsWith("ASIA")) {
      return false;
    }
    if (!credentials.expiration) {
      return true;
    }
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    return credentials.expiration < fiveMinutesFromNow;
  }

  /**
   * Refresh credentials by calling STS AssumeRole
   */
  async refreshCredentials(currentCredentials: AWSCredentials): Promise<AWSCredentials> {
    const roleArn = this.roleArn || process.env.AWS_MANAGEMENT_ACCOUNT_ROLE_ARN;
    if (!roleArn) {
      console.warn("[STSCredentialManager] No role ARN configured, cannot refresh credentials");
      return currentCredentials;
    }

    try {
      console.log("[STSCredentialManager] Refreshing STS credentials...");

      const sts = new AWS.STS({
        accessKeyId: currentCredentials.accessKeyId,
        secretAccessKey: currentCredentials.secretAccessKey,
        sessionToken: currentCredentials.sessionToken,
        region: this.region,
      });

      const result = await sts.assumeRole({
        RoleArn: roleArn,
        RoleSessionName: this.roleSessionName || `lab-session-${Date.now()}`,
        DurationSeconds: 3600,
      }).promise();

      if (!result.Credentials) {
        throw new Error("Failed to get credentials from STS AssumeRole");
      }

      const newCredentials: AWSCredentials = {
        accessKeyId: result.Credentials.AccessKeyId!,
        secretAccessKey: result.Credentials.SecretAccessKey!,
        sessionToken: result.Credentials.SessionToken!,
        expiration: result.Credentials.Expiration,
        region: this.region,
      };

      console.log("[STSCredentialManager] Credentials refreshed successfully");
      return newCredentials;
    } catch (error) {
      console.error("[STSCredentialManager] Failed to refresh credentials:", error);
      throw error;
    }
  }
}

export class TerminalInstance {
  private sessionId: string;
  private credentials: AWSCredentials;
  private commandHistory: string[] = [];
  private isExecuting = false;
  private credentialManager: STSCredentialManager;

  constructor(sessionId: string, credentials: AWSCredentials) {
    this.sessionId = sessionId;
    this.credentials = credentials;
    this.credentialManager = new STSCredentialManager(
      undefined,
      undefined,
      credentials.region
    );
  }

  /**
   * Check if credentials are temporary/mock credentials (created at lab start)
   */
  private isTemporaryCredential(): boolean {
    return this.credentials.accessKeyId === "DEVKEY";
  }

  /**
   * Check if credentials are STS temporary credentials (ASIA keys)
   */
  private isStsTemporaryCredential(): boolean {
    return this.credentials.accessKeyId?.startsWith("ASIA");
  }

  /**
   * Refresh credentials if they are STS temporary credentials and expired/expiring
   */
  private async refreshCredentialsIfNeeded(): Promise<void> {
    if (this.isTemporaryCredential()) {
      console.log(`[Terminal:${this.sessionId}] Skipping refresh - using temporary DEVKEY credentials`);
      return;
    }

    if (!this.isStsTemporaryCredential()) {
      return;
    }

    if (!this.credentialManager.needsRefresh(this.credentials)) {
      return;
    }

    console.log(`[Terminal:${this.sessionId}] STS credentials expiring soon, refreshing...`);

    try {
      this.credentials = await this.credentialManager.refreshCredentials(this.credentials);
      console.log(`[Terminal:${this.sessionId}] STS credentials refreshed successfully`);
    } catch (error) {
      console.error(`[Terminal:${this.sessionId}] Failed to refresh STS credentials:`, error);
      throw error;
    }
  }

  /**
   * Get AWS SDK credentials object with session token
   */
  private getAwsSdkCredentials(): AWS.Credentials {
    const creds: any = {
      accessKeyId: this.credentials.accessKeyId,
      secretAccessKey: this.credentials.secretAccessKey,
    };

    if (this.credentials.sessionToken) {
      creds.sessionToken = this.credentials.sessionToken;
    }

    return new AWS.Credentials(creds);
  }

  /**
   * Get environment variables for CLI execution with session token
   */
  private getCliEnvironment(): { [key: string]: string } {
    const env: { [key: string]: string } = {
      ...process.env as { [key: string]: string },
      // Ensure PATH includes /usr/local/bin where AWS CLI v2 is installed
      PATH: process.env.PATH 
        ? `${process.env.PATH}:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin`
        : '/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin',
      AWS_ACCESS_KEY_ID: this.credentials.accessKeyId,
      AWS_SECRET_ACCESS_KEY: this.credentials.secretAccessKey,
      AWS_DEFAULT_REGION: this.credentials.region,
      AWS_REGION: this.credentials.region,
    };

    if (this.credentials.sessionToken) {
      env.AWS_SESSION_TOKEN = this.credentials.sessionToken;
    }

    return env;
  }

  /**
   * Validate AWS credentials by calling sts:GetCallerIdentity
   */
  async validateCredentials(): Promise<{ valid: boolean; error?: string }> {
    // Check for DEVKEY - only allow in development mode
    if (this.isTemporaryCredential()) {
      const isDevMode = process.env.NODE_ENV !== "production";
      if (isDevMode) {
        console.log(`[Terminal:${this.sessionId}] ✓ Using DEVKEY credentials (development mode)`);
        return { valid: true };
      } else {
        console.error(`[Terminal:${this.sessionId}] ✗ DEVKEY credentials not allowed in production`);
        return { 
          valid: false, 
          error: "Invalid credentials in production. Please configure AWS credentials." 
        };
      }
    }

    try {
      await this.refreshCredentialsIfNeeded();

      const sts = new AWS.STS({
        credentials: this.getAwsSdkCredentials(),
        region: this.credentials.region,
      });

      const maskedKey = this.credentials.accessKeyId
        ? this.credentials.accessKeyId.substring(0, 4) + "*".repeat(Math.max(0, this.credentials.accessKeyId.length - 8)) + this.credentials.accessKeyId.substring(Math.max(0, this.credentials.accessKeyId.length - 4))
        : "undefined";

      const tokenStatus = this.credentials.sessionToken ? "with session token" : "without session token";
      console.log(`[Terminal:${this.sessionId}] Validating AWS credentials... (Key: ${maskedKey}, Region: ${this.credentials.region}, ${tokenStatus})`);

      const result = await sts.getCallerIdentity().promise();

      console.log(`[Terminal:${this.sessionId}] ✓ Credentials valid. Account: ${result.Account}, UserId: ${result.UserId}, ARN: ${result.Arn}`);

      return { valid: true };
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      const errorCode = error?.code || "UnknownError";

      console.error(`[Terminal:${this.sessionId}] ✗ Credential validation failed (${errorCode}): ${errorMessage}`);

      const isInvalidToken =
        errorMessage?.includes("security token") ||
        errorMessage?.includes("invalid") ||
        errorMessage?.includes("NotAuthorized") ||
        errorMessage?.includes("does not exist") ||
        errorCode === "InvalidClientTokenId" ||
        errorCode === "SignatureDoesNotMatch";

      if (isInvalidToken) {
        let userErrorMessage = "AWS credentials are invalid or expired. Please verify your access key ID and secret access key.";
        
        if (errorMessage?.includes("does not exist")) {
          userErrorMessage = "ERROR: The AWS Access Key ID does not exist in our records.\n\nPlease verify:\n1. You are using the correct Access Key ID\n2. The IAM user still exists in AWS\n3. The access key is still active";
        } else if (errorCode === "SignatureDoesNotMatch") {
          userErrorMessage = "ERROR: The AWS Secret Access Key is incorrect.";
        } else if (errorMessage?.includes("ExpiredToken")) {
          userErrorMessage = "ERROR: AWS session credentials have expired. Please refresh your credentials or start a new lab session.";
        }

        return { valid: false, error: userErrorMessage };
      }

      return { valid: false, error: `Credential validation failed: ${errorMessage}` };
    }
  }

  /**
   * Get mock response for development mode
   */
  private getMockResponse(service: string, action: string, args: string[]): { command: string; exitCode: number; stdout: string; stderr: string; timestamp: number } {
    switch (service) {
      case 'sts':
        if (action === 'get-caller-identity') {
          return {
            command: '',
            exitCode: 0,
            stdout: JSON.stringify({ UserId: 'AIDAI23DJSJ2NEXAMPLE:mock-session', Account: '123456789012', Arn: 'arn:aws:sts::123456789012:assumed-role/mock-role/mock-session' }, null, 2),
            stderr: '',
            timestamp: Date.now(),
          };
        }
        break;

      case 's3':
      case 's3api':
        if (action === 'ls' || action === 'list-buckets') {
          return {
            command: '',
            exitCode: 0,
            stdout: JSON.stringify({ Buckets: [{ Name: 'mock-bucket-1', CreationDate: '2024-01-01T00:00:00.000Z' }] }, null, 2),
            stderr: '',
            timestamp: Date.now(),
          };
        }
        break;

      case 'ec2':
        if (action === 'describe-instances') {
          return {
            command: '',
            exitCode: 0,
            stdout: JSON.stringify({ Reservations: [{ Instances: [{ InstanceId: 'i-1234567890abcdef0', State: { Name: 'running' } }] }] }, null, 2),
            stderr: '',
            timestamp: Date.now(),
          };
        }
        break;

      case 'iam':
        if (action === 'list-users' || action === 'get-user') {
          return {
            command: '',
            exitCode: 0,
            stdout: JSON.stringify({ User: { UserName: 'mock-admin', UserId: 'AIDAI23DJSJ2NEXAMPLE' } }, null, 2),
            stderr: '',
            timestamp: Date.now(),
          };
        }
        break;

      case 'lambda':
        if (action === 'list-functions') {
          return {
            command: '',
            exitCode: 0,
            stdout: JSON.stringify({ Functions: [{ FunctionName: 'mock-function', Runtime: 'nodejs18.x' }] }, null, 2),
            stderr: '',
            timestamp: Date.now(),
          };
        }
        break;
    }

    return {
      command: '',
      exitCode: 0,
      stdout: JSON.stringify({ message: `Mock response for ${service} ${action}`, service, action, args }, null, 2),
      stderr: '',
      timestamp: Date.now(),
    };
  }

  /**
   * Execute AWS command using AWS SDK (preferred method - doesn't require CLI)
   */
  private async executeAwsSdkCommand(serviceName: string, action: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    try {
      // Map service names to AWS SDK constructors
      const serviceMap: Record<string, any> = {
        's3': AWS.S3,
        's3api': AWS.S3,
        'ec2': AWS.EC2,
        'iam': AWS.IAM,
        'lambda': AWS.Lambda,
        'sts': AWS.STS,
        'dynamodb': AWS.DynamoDB,
        'cloudwatch': AWS.CloudWatch,
        'sns': AWS.SNS,
        'sqs': AWS.SQS,
        'rds': AWS.RDS,
        'ecs': AWS.ECS,
        'eks': AWS.EKS,
        'ssm': AWS.SSM,
        'logs': AWS.CloudWatchLogs,
        'events': AWS.CloudWatchEvents,
      };

      const ServiceClass = serviceMap[serviceName.toLowerCase()];
      if (!ServiceClass) {
        return {
          exitCode: 1,
          stdout: '',
          stderr: `Unsupported AWS service: ${serviceName}. Supported services: ${Object.keys(serviceMap).join(', ')}`
        };
      }

      // Parse CLI-style arguments to SDK params
      const params = this.parseCliArgsToSdkParams(serviceName, action, args);

      console.log(`[Terminal:${this.sessionId}] Calling ${serviceName}.${action} with params:`, JSON.stringify(params));

      const service = new ServiceClass({
        credentials: this.getAwsSdkCredentials(),
        region: this.credentials.region,
      });

      // Convert action from PascalCase to SDK method call
      const methodName = action.charAt(0).toLowerCase() + action.slice(1).replace(/-([a-z])/g, (g: string) => g[1].toUpperCase());
      
      const result = await (service as any)[methodName](params).promise();
      
      return {
        exitCode: 0,
        stdout: JSON.stringify(result, null, 2),
        stderr: ''
      };
    } catch (error: any) {
      console.error(`[Terminal:${this.sessionId}] SDK Error:`, error.message);
      
      // Return the actual error - no mock fallback
      const errorMessage = error.message || String(error);
      return {
        exitCode: 1,
        stdout: '',
        stderr: errorMessage
      };
    }
  }

  /**
   * Parse CLI-style arguments to SDK parameters
   */
  private parseCliArgsToSdkParams(serviceName: string, action: string, args: string[]): Record<string, any> {
    const params: Record<string, any> = {};
    let i = 0;
    
    while (i < args.length) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        const key = arg.slice(2).replace(/-([a-z])/g, (g: string) => g[1].toUpperCase());
        
        // Check if next arg is a value (not another flag)
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          const value: any = args[i + 1];
          
          // Handle boolean flags
          if (value === 'true') params[key] = true;
          else if (value === 'false') params[key] = false;
          else if (!isNaN(Number(value))) params[key] = Number(value);
          else params[key] = value;
          
          i += 2;
        } else {
          params[key] = true;
          i += 1;
        }
      } else {
        i += 1;
      }
    }
    
    return params;
  }

  /**
   * Execute AWS CLI command with user credentials
   */
  async executeCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.isExecuting) {
        console.warn(`[Terminal:${this.sessionId}] Previous command still executing, allowing new command`);
      }

      this.isExecuting = true;
      this.commandHistory.push(command);

      const safetyTimeout = setTimeout(() => {
        if (this.isExecuting) {
          console.warn(`[Terminal:${this.sessionId}] Safety timeout - resetting isExecuting flag`);
          this.isExecuting = false;
        }
      }, 60000);

      const env = this.getCliEnvironment();
      const [cmd, ...args] = command.trim().split(/\s+/);

      console.log(`[Terminal:${this.sessionId}] Executing: ${command}`);

      // Check if it's an AWS CLI command
      if (cmd === 'aws' && args.length > 0) {
        const service = args[0];
        const action = args[1];

        // Check for DEVKEY (development mode)
        console.log(`[Terminal:${this.sessionId}] Credential check - accessKeyId: ${this.credentials.accessKeyId ? this.credentials.accessKeyId.substring(0, 4) + '****' : 'undefined'}, region: ${this.credentials.region}, hasSessionToken: ${!!this.credentials.sessionToken}`);
        
        if (this.credentials.accessKeyId === 'DEVKEY') {
          console.log(`[Terminal:${this.sessionId}] Using mock response for development mode`);
          const mockResponse = this.getMockResponse(service, action, args);
          mockResponse.command = command;
          this.isExecuting = false;
          clearTimeout(safetyTimeout);
          resolve(JSON.stringify(mockResponse));
          return;
        }

        // Use AWS SDK instead of CLI (more reliable, no CLI dependency)
        this.executeAwsSdkCommand(service, action, args.slice(2)).then((result) => {
          this.isExecuting = false;
          clearTimeout(safetyTimeout);
          
          const response = {
            command,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            timestamp: Date.now(),
          };
          
          resolve(JSON.stringify(response));
        }).catch((error) => {
          this.isExecuting = false;
          clearTimeout(safetyTimeout);
          
          const response = {
            command,
            exitCode: 1,
            stdout: '',
            stderr: error.message || String(error),
            timestamp: Date.now(),
          };
          
          resolve(JSON.stringify(response));
        });
      } else {
        // Non-AWS command - execute directly
        const child = spawn(cmd, args, {
          env,
          shell: true,
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        child.on('close', (code: number | null) => {
          this.isExecuting = false;
          clearTimeout(safetyTimeout);
          
          // Handle exit code 127 (command not found) - specifically for AWS CLI
          if (code === 127) {
            let errorMessage = '';
            
            if (cmd === 'aws') {
              errorMessage = `AWS CLI is not installed in this environment.\n\n` +
                `Error: The 'aws' command was not found (exit code: 127)\n\n` +
                `Options to resolve:\n` +
                `1. Install AWS CLI v2:\n` +
                `   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"\n` +
                `   unzip -q awscliv2.zip && ./aws/install\n\n` +
                `2. Use AWS SDK instead of CLI - this terminal supports SDK commands\n` +
                `   Example: Use Python with boto3 or Node.js with AWS SDK\n\n` +
                `3. If running in Docker, add AWS CLI to your Dockerfile:\n` +
                `   RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \\ \n` +
                `       unzip -q awscliv2.zip && ./aws/install\n\n` +
                `Note: The terminal also supports AWS SDK commands which don't require CLI installation.`;
            } else {
              errorMessage = `Command not found: ${cmd}. Please check if the command is installed.`;
            }
            
            const result = {
              command,
              exitCode: 127,
              stdout: '',
              stderr: errorMessage,
              timestamp: Date.now(),
            };
            resolve(JSON.stringify(result));
            return;
          }
          
          const result = {
            command,
            exitCode: code || 0,
            stdout,
            stderr,
            timestamp: Date.now(),
          };
          
          resolve(JSON.stringify(result));
        });

        child.on('error', (error: Error) => {
          this.isExecuting = false;
          clearTimeout(safetyTimeout);
          
          // Check if it's a "command not found" type error
          const isCommandNotFound = error.message.includes('ENOENT') || error.message.includes('not found');
          
          let errorMessage = error.message;
          if (isCommandNotFound && cmd === 'aws') {
            errorMessage = `AWS CLI is not installed in this environment.\n\n` +
              `Error: ${error.message}\n\n` +
              `To use AWS CLI, install it with:\n` +
              `  curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"\n` +
              `  unzip -q awscliv2.zip && ./aws/install\n\n` +
              `Alternatively, use AWS SDK commands which are supported by this terminal.`;
          }
          
          const result = {
            command,
            exitCode: isCommandNotFound ? 127 : 1,
            stdout: '',
            stderr: errorMessage,
            timestamp: Date.now(),
          };
          
          resolve(JSON.stringify(result));
        });
      }
    });
  }

  /**
   * Resize terminal
   */
  resize(cols: number, rows: number): void {
    console.log(`[Terminal:${this.sessionId}] Resized to ${cols}x${rows}`);
  }

  /**
   * Get command history
   */
  getHistory(): string[] {
    return this.commandHistory;
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.commandHistory = [];
  }
}

export class TerminalServer {
  private terminals: Map<string, TerminalInstance> = new Map();

  /**
   * Create a new terminal instance
   */
  createTerminal(sessionId: string, credentials: AWSCredentials): TerminalInstance {
    const terminal = new TerminalInstance(sessionId, credentials);
    this.terminals.set(sessionId, terminal);
    console.log(`[TerminalServer] Terminal created: ${sessionId}`);
    return terminal;
  }

  /**
   * Get terminal instance
   */
  getTerminal(sessionId: string): TerminalInstance | undefined {
    return this.terminals.get(sessionId);
  }

  /**
   * Destroy terminal instance
   */
  destroyTerminal(sessionId: string): void {
    this.terminals.delete(sessionId);
    console.log(`[TerminalServer] Terminal destroyed: ${sessionId}`);
  }

  /**
   * Get all active terminals
   */
  getActiveSessions(): string[] {
    return Array.from(this.terminals.keys());
  }
}
