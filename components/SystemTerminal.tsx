import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal as TerminalIcon,
  Play,
  RotateCcw,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Trash2,
  HelpCircle,
  Activity,
  Cpu,
  Shield,
  Wifi,
  CornerDownLeft,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { AppSettings, VirtualIdentity } from '../types';

export interface SystemTerminalProps {
  settings: AppSettings;
  currentIdentity: VirtualIdentity;
  isConnected: boolean;
  addLog?: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
  className?: string;
}

interface CommandHistoryEntry {
  id: string;
  command: string;
  output: string | React.ReactNode;
  timestamp: string;
  isError?: boolean;
}

const ASCII_BANNER = `
 ██████╗ ███████╗███╗   ██╗██╗   ██╗███╗   ███╗███████╗██████╗  █████╗ ████████╗███████╗
 ██╔══██╗██╔════╝████╗  ██║██║   ██║████╗ ████║██╔════╝██╔══██╗██╔══██╗╚══██╔══╝██╔════╝
 ██████╔╝█████╗  ██╔██╗ ██║██║   ██║██╔████╔██║█████╗  ██████╔╝███████║   ██║   █████╗  
 ██╔══██╗██╔══╝  ██║╚██╗██║██║   ██║██║╚██╔╝██║██╔══╝  ██╔══██╗██╔══██║   ██║   ██╔══╝  
 ██║  ██║███████╗██║ ╚████║╚██████╔╝██║ ╚═╝ ██║███████╗██║  ██║██║  ██║   ██║   ███████╗
 ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝
      [ SYSTEM & NOYAU · CONSOLE D'EXPLOITATION SÉCURISÉE SSH v2.4-PQC (eBPF/XDP) ]
`;

export const SystemTerminal: React.FC<SystemTerminalProps> = ({
  settings,
  currentIdentity,
  isConnected,
  addLog,
  className = '',
}) => {
  const [history, setHistory] = useState<CommandHistoryEntry[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [commandLog, setCommandLog] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [crtEffect, setCrtEffect] = useState(false);
  const [activeInterval, setActiveInterval] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Initial welcome message with ASCII banner
  useEffect(() => {
    const welcomeEntry: CommandHistoryEntry = {
      id: 'init-motd',
      command: 'motd',
      timestamp: new Date().toLocaleTimeString('fr-FR'),
      output: (
        <div className="space-y-2 text-slate-300">
          <pre className="text-cyan-400 font-bold text-[10px] sm:text-xs leading-none select-none overflow-x-auto py-1">
            {ASCII_BANNER}
          </pre>
          <div className="border-t border-slate-800 pt-2 text-xs font-mono space-y-1">
            <div className="text-emerald-400 font-semibold">
              ● Session SSH eBPF initialisée · Hôte cible : renumerate-gw01.internal (Linux 6.8.9-hardened-pqc)
            </div>
            <div className="text-slate-400 text-[11px]">
              Chiffrement de canal : <span className="text-cyan-300">ChaCha20-Poly1305</span> · KEX :{' '}
              <span className="text-purple-300">{settings.postQuantumKex.toUpperCase()}</span> · TTY : pts/3 (xterm-256color)
            </div>
            <div className="text-amber-300 text-[11px]">
              Tapez <span className="text-white font-bold bg-slate-800 px-1 rounded">help</span> pour afficher la liste des commandes de diagnostic réseau.
            </div>
          </div>
        </div>
      ),
    };
    setHistory([welcomeEntry]);
  }, [settings.postQuantumKex]);

  // Auto-scroll on new output
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [history, isRunning]);

  // Clean interval on unmount
  useEffect(() => {
    return () => {
      if (activeInterval) clearInterval(activeInterval);
    };
  }, [activeInterval]);

  const handleClear = () => {
    setHistory([]);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleCopyLogs = () => {
    const text = history
      .map((h) => {
        const out = typeof h.output === 'string' ? h.output : '[Sortie binaire/complexe]';
        return `[${h.timestamp}] root@renumerate-wg0:~# ${h.command}\n${out}`;
      })
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Helper generating ASCII graph / progress
  const renderAsciiBar = (val: number, max = 100, length = 20) => {
    const filled = Math.round((val / max) * length);
    const empty = Math.max(0, length - filled);
    return `[${'#'.repeat(filled)}${'.'.repeat(empty)}] ${val}/${max}`;
  };

  // Command Execution Engine
  const executeCommand = useCallback(
    (rawCmd: string) => {
      const trimmed = rawCmd.trim();
      if (!trimmed) return;

      const [cmd, ...args] = trimmed.split(/\s+/);
      const lowerCmd = cmd.toLowerCase();
      const timestamp = new Date().toLocaleTimeString('fr-FR');

      // Update command log for up/down history navigation
      setCommandLog((prev) => [...prev, trimmed]);
      setHistoryIndex(null);

      if (lowerCmd === 'clear') {
        handleClear();
        return;
      }

      let output: string | React.ReactNode = '';
      let isError = false;

      switch (lowerCmd) {
        case 'help': {
          output = (
            <div className="space-y-2 text-xs font-mono">
              <div className="text-cyan-400 font-bold border-b border-slate-800 pb-1">
                Commandes de diagnostic réseau &amp; sous-systèmes disponibles :
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-emerald-400 font-bold">ping &lt;host&gt;</span>
                  <p className="text-slate-400">Émission ICMP / RTT en direct avec graphique de latence ASCII</p>
                </div>
                <div>
                  <span className="text-emerald-400 font-bold">traceroute &lt;host&gt;</span>
                  <p className="text-slate-400">Traçage de route saut par saut avec géolocalisation &amp; ASN</p>
                </div>
                <div>
                  <span className="text-emerald-400 font-bold">mtr &lt;host&gt;</span>
                  <p className="text-slate-400">Diagnostic continu de gigue et perte de paquets (My Traceroute)</p>
                </div>
                <div>
                  <span className="text-emerald-400 font-bold">wg show</span>
                  <p className="text-slate-400">État du tunnel WireGuard wg0, clés cryptographiques et débit Rx/Tx</p>
                </div>
                <div>
                  <span className="text-emerald-400 font-bold">nft list ruleset</span>
                  <p className="text-slate-400">Règles actives du pare-feu nftables (anti-fuite, Kill Switch)</p>
                </div>
                <div>
                  <span className="text-emerald-400 font-bold">ss -tulpn / netstat</span>
                  <p className="text-slate-400">Sockets réseau ouvertes, ports d&apos;écoute et interfaces bindées</p>
                </div>
                <div>
                  <span className="text-emerald-400 font-bold">sysctl -a</span>
                  <p className="text-slate-400">Directives noyau actives (BBR, rp_filter, mlock, syncookies)</p>
                </div>
                <div>
                  <span className="text-emerald-400 font-bold">pqc status</span>
                  <p className="text-slate-400">État de l&apos;échange post-quantique ML-KEM-1024 / Kyber</p>
                </div>
                <div>
                  <span className="text-emerald-400 font-bold">htop / top</span>
                  <p className="text-slate-400">Surveillance des processus noyau, sondes eBPF et charge CPU</p>
                </div>
                <div>
                  <span className="text-emerald-400 font-bold">speedtest / iperf3</span>
                  <p className="text-slate-400">Test de bande passante instantané avec jauge ASCII</p>
                </div>
                <div>
                  <span className="text-emerald-400 font-bold">ip link / ifconfig</span>
                  <p className="text-slate-400">État des interfaces réseau (wg0, eth0, sinkhole0, lo)</p>
                </div>
                <div>
                  <span className="text-emerald-400 font-bold">banner / motd</span>
                  <p className="text-slate-400">Affiche la bannière d&apos;accueil Renumerate Kernel</p>
                </div>
                <div>
                  <span className="text-emerald-400 font-bold">clear</span>
                  <p className="text-slate-400">Efface le tampon d&apos;affichage de la console</p>
                </div>
              </div>
            </div>
          );
          break;
        }

        case 'banner':
        case 'motd': {
          output = (
            <pre className="text-cyan-400 font-bold text-[10px] sm:text-xs leading-none select-none overflow-x-auto py-1">
              {ASCII_BANNER}
            </pre>
          );
          break;
        }

        case 'ping': {
          const target = args[0] || currentIdentity.ip || '1.1.1.1';
          const rtts = [14.2, 13.8, 14.9, 13.5, 14.1];
          const avg = (rtts.reduce((a, b) => a + b, 0) / rtts.length).toFixed(2);
          output = (
            <div className="font-mono text-[11px] space-y-1">
              <div className="text-slate-300">
                PING {target} ({target}) 56(84) bytes of data. Tunnel: wg0 (MTU {settings.mtuSize}).
              </div>
              {rtts.map((rtt, idx) => (
                <div key={idx} className="text-slate-400 flex items-center justify-between">
                  <span>
                    64 bytes from {target}: icmp_seq={idx + 1} ttl=58 time={rtt} ms
                  </span>
                  <span className="text-cyan-400 hidden sm:inline">
                    {'█'.repeat(Math.round(rtt / 2))} ({rtt} ms)
                  </span>
                </div>
              ))}
              <div className="text-slate-500 pt-1 border-t border-slate-800">
                --- {target} ping statistics ---
              </div>
              <div className="text-emerald-400">
                5 packets transmitted, 5 received, 0% packet loss, time 4004ms
              </div>
              <div className="text-slate-300">
                rtt min/avg/max/mdev = 13.50/{avg}/14.90/0.48 ms [BBR Congestion Control]
              </div>
            </div>
          );
          break;
        }

        case 'traceroute':
        case 'tracepath': {
          const target = args[0] || '1.1.1.1';
          output = (
            <div className="font-mono text-[11px] space-y-1">
              <div className="text-slate-300">
                traceroute to {target} (30 hops max, 60 byte packets, wg0 cryptographic overlay):
              </div>
              <div className="space-y-0.5 text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="text-cyan-400 font-bold">1</span>
                  <span className="text-slate-200">10.84.0.1 (gateway.wg0)</span>
                  <span className="text-emerald-400">0.842 ms</span>
                  <span className="text-slate-500">[Fast Path eBPF]</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-cyan-400 font-bold">2</span>
                  <span className="text-slate-200">194.26.29.1 (relais-chiffre-eur.vortex)</span>
                  <span className="text-emerald-400">6.120 ms</span>
                  <span className="text-slate-500">[AS201814 M247 Europe]</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-cyan-400 font-bold">3</span>
                  <span className="text-slate-200">185.220.101.5 (exit-sanctuary.renumerate)</span>
                  <span className="text-emerald-400">12.440 ms</span>
                  <span className="text-purple-400">[Double Hop Exit Node]</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-cyan-400 font-bold">4</span>
                  <span className="text-slate-200">{target}</span>
                  <span className="text-emerald-400">14.050 ms</span>
                  <span className="text-cyan-300">[Target Destination REACHED]</span>
                </div>
              </div>
              <div className="text-[10px] text-emerald-400 pt-1">
                ✔ Trajet complet confiné sous tunnel WireGuard sans exposition de la passerelle FAI.
              </div>
            </div>
          );
          break;
        }

        case 'mtr': {
          output = (
            <div className="font-mono text-[11px] space-y-2">
              <div className="text-cyan-400 font-bold">
                My traceroute [v0.95] · Interface: wg0 · Gigue &amp; Dispersion en temps réel
              </div>
              <div className="border border-slate-800 rounded-lg overflow-x-auto p-2 bg-slate-950/80">
                <table className="w-full text-left text-[10px]">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800">
                      <th className="py-1">HÔTE</th>
                      <th className="py-1">PERTE%</th>
                      <th className="py-1">ENVOYÉ</th>
                      <th className="py-1">DERNIER</th>
                      <th className="py-1">MOY</th>
                      <th className="py-1">MEILLEUR</th>
                      <th className="py-1">PIRE</th>
                      <th className="py-1">ÉCART-TYPE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-slate-300">
                    <tr>
                      <td className="py-1 text-slate-200">1. gateway.wg0 (10.84.0.1)</td>
                      <td className="text-emerald-400">0.0%</td>
                      <td>25</td>
                      <td>0.8ms</td>
                      <td>0.9ms</td>
                      <td>0.7ms</td>
                      <td>1.4ms</td>
                      <td>0.2</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-200">2. core-de-fra.renumerate.net</td>
                      <td className="text-emerald-400">0.0%</td>
                      <td>25</td>
                      <td>7.1ms</td>
                      <td>7.4ms</td>
                      <td>6.8ms</td>
                      <td>9.2ms</td>
                      <td>0.5</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-200">3. exit-01-ch.renumerate.net</td>
                      <td className="text-emerald-400">0.0%</td>
                      <td>25</td>
                      <td>13.8ms</td>
                      <td>14.1ms</td>
                      <td>13.4ms</td>
                      <td>16.5ms</td>
                      <td>0.7</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
          break;
        }

        case 'wg':
        case 'wireguard': {
          output = (
            <div className="font-mono text-[11px] space-y-1 text-slate-300">
              <div className="text-cyan-400 font-bold">interface: wg0</div>
              <div className="pl-4 space-y-0.5">
                <div>public key: 4bE28F8b4KzVvU...8bX9Q=</div>
                <div>private key: (hidden via strict MemoryLock mlock)</div>
                <div>listening port: 51820</div>
                <div>fwmark: 0xca6c</div>
                <div>mtu: {settings.mtuSize}</div>
              </div>
              <div className="text-purple-400 font-bold pt-2">peer: {currentIdentity.ip || '194.26.29.112'}:51820</div>
              <div className="pl-4 space-y-0.5">
                <div>endpoint: {currentIdentity.ip || '194.26.29.112'}:51820</div>
                <div>allowed ips: 0.0.0.0/0, ::/0 (Full Tunnel Default Route)</div>
                <div className="text-emerald-400">latest handshake: 14 seconds ago</div>
                <div>transfer: 124.62 MiB received, 18.91 MiB sent</div>
                <div>persistent keepalive: every 25 seconds</div>
                <div className="text-cyan-300">pqc kex status: {settings.postQuantumKex.toUpperCase()} active (re-key: 10m)</div>
              </div>
            </div>
          );
          break;
        }

        case 'nft':
        case 'firewall': {
          output = (
            <div className="font-mono text-[11px] space-y-1 text-slate-300">
              <div className="text-cyan-400 font-bold">table inet renumerate_filter {'{'}</div>
              <div className="pl-4 text-slate-400 space-y-0.5">
                <div>chain input {'{'} type filter hook input priority 0; policy drop; {'}'}</div>
                <div>chain forward {'{'} type filter hook forward priority 0; policy drop; {'}'}</div>
                <div>
                  chain output {'{'} type filter hook output priority 0; policy accept;
                </div>
                <div className="pl-4 text-emerald-400">
                  oifname &quot;wg0&quot; accept comment &quot;wireguard:fast_path_accept&quot;
                </div>
                <div className="pl-4 text-amber-400">
                  udp dport 53 oifname != &quot;wg0&quot; drop comment &quot;anti_dns_leak_sinkhole&quot;
                </div>
                <div className="pl-4 text-rose-400">
                  udp dport 443 oifname != &quot;wg0&quot; drop comment &quot;block_quic_leak&quot;
                </div>
                <div className="pl-4 text-slate-500">
                  oifname &quot;lo&quot; accept comment &quot;allow_local_loopback&quot;
                </div>
                <div>{'}'}</div>
              </div>
              <div>{'}'}</div>
              <div className="text-emerald-400 text-[10px] pt-1">
                ✔ Pare-feu nftables actif : Kill Switch Strict et confinement étanche appliqués.
              </div>
            </div>
          );
          break;
        }

        case 'ss':
        case 'netstat': {
          output = (
            <div className="font-mono text-[11px] space-y-1">
              <div className="text-slate-400">Netid  State      Recv-Q  Send-Q   Local Address:Port      Peer Address:Port</div>
              <div className="text-cyan-300">udp    UNCONN     0       0        0.0.0.0:51820           0.0.0.0:* (wireguard)</div>
              <div className="text-emerald-300">udp    UNCONN     0       0        127.0.0.1:53            0.0.0.0:* (dnscrypt-proxy)</div>
              <div className="text-purple-300">tcp    LISTEN     0       128      127.0.0.1:9050          0.0.0.0:* (vortex-socks5)</div>
              <div className="text-slate-300">tcp    ESTAB      0       0        10.84.0.2:48392         185.220.101.5:443 (tls1.3)</div>
            </div>
          );
          break;
        }

        case 'sysctl': {
          output = (
            <div className="font-mono text-[11px] space-y-1 text-slate-300">
              <div className="text-cyan-400 font-bold"># Paramètres noyau actifs (sysctl -a / procfs) :</div>
              <div>net.ipv4.tcp_congestion_control = <span className="text-emerald-400">{settings.tcpCongestionControl}</span></div>
              <div>net.ipv4.conf.all.rp_filter = <span className="text-emerald-400">1 (Strict Reverse Path)</span></div>
              <div>net.ipv4.conf.all.arp_ignore = <span className="text-emerald-400">2 (Anti-ARP Spoof)</span></div>
              <div>net.ipv4.tcp_syncookies = <span className="text-emerald-400">1</span></div>
              <div>net.ipv6.conf.all.disable_ipv6 = <span className="text-amber-400">{settings.ipv6LeakProtection ? '1 (Confiné)' : '0'}</span></div>
              <div>fs.suid_dumpable = <span className="text-emerald-400">0 (Zero Memory Dump)</span></div>
              <div>vm.swappiness = <span className="text-emerald-400">0 (Strict Memory Lock)</span></div>
            </div>
          );
          break;
        }

        case 'pqc': {
          output = (
            <div className="font-mono text-[11px] space-y-1 text-slate-300">
              <div className="text-purple-400 font-bold">Post-Quantum Cryptography Engine (FIPS 203 / ML-KEM) :</div>
              <div>Algorithme actif : <span className="text-emerald-400 font-bold">{settings.postQuantumKex.toUpperCase()}</span></div>
              <div>Sécurité NIST : <span className="text-cyan-300">Niveau 5 (Équivalent AES-256 contre attaques Shor/Grover)</span></div>
              <div>Taille de clé publique : <span className="text-slate-200">1 568 octets</span></div>
              <div>Taille du texte chiffré (Ciphertext) : <span className="text-slate-200">1 568 octets</span></div>
              <div>Rotation éphémère (PFS) : <span className="text-emerald-400">Toutes les 10 minutes</span></div>
              <div className="text-emerald-400 text-[10px] pt-1">
                ✔ Résistance mathématique garantie contre l&apos;interception rétroactive &quot;Store Now, Decrypt Later&quot;.
              </div>
            </div>
          );
          break;
        }

        case 'ip':
        case 'ifconfig': {
          output = (
            <div className="font-mono text-[11px] space-y-1.5 text-slate-300">
              <div>
                <span className="text-cyan-400 font-bold">1: lo:</span> &lt;LOOPBACK,UP,LOWER_UP&gt; mtu 65536 qdisc noqueue state UNKNOWN
                <div className="pl-4 text-slate-400">inet 127.0.0.1/8 scope host lo</div>
              </div>
              <div>
                <span className="text-cyan-400 font-bold">2: eth0:</span> &lt;BROADCAST,MULTICAST,UP,LOWER_UP&gt; mtu 1500 qdisc fq_codel state UP
                <div className="pl-4 text-slate-400">inet 192.168.1.42/24 brd 192.168.1.255 scope global eth0</div>
              </div>
              <div>
                <span className="text-emerald-400 font-bold">3: wg0:</span> &lt;POINTOPOINT,NOARP,UP,LOWER_UP&gt; mtu {settings.mtuSize} qdisc noqueue state UNKNOWN
                <div className="pl-4 text-emerald-300">inet 10.84.0.2/32 scope global wg0</div>
                <div className="pl-4 text-slate-500">RX: 130 682 packets (124 MiB) · TX: 84 921 packets (18 MiB)</div>
              </div>
            </div>
          );
          break;
        }

        case 'speedtest':
        case 'iperf3': {
          output = (
            <div className="font-mono text-[11px] space-y-1 text-slate-300">
              <div className="text-cyan-400 font-bold">Connecting to speedtest server: iperf.renumerate.internal:5201</div>
              <div>Interval           Transfer     Bitrate         Retr  Cwnd</div>
              <div>0.00-1.00   sec   48.2 MBytes   404 Mbits/sec    0    1.42 MBytes</div>
              <div>1.00-2.00   sec   52.4 MBytes   439 Mbits/sec    0    1.55 MBytes</div>
              <div>2.00-3.00   sec   51.8 MBytes   434 Mbits/sec    0    1.55 MBytes</div>
              <div className="pt-1 text-emerald-400 font-bold">
                Débit descendant moyen : 425.6 Mbit/s {renderAsciiBar(425, 500, 15)}
              </div>
              <div className="text-slate-400">Latence moyenne : 14.2 ms · Gigue : 0.4 ms · Perte : 0.0%</div>
            </div>
          );
          break;
        }

        case 'htop':
        case 'top': {
          output = (
            <div className="font-mono text-[11px] space-y-1 text-slate-300">
              <div className="text-cyan-400 font-bold">
                CPU [||||||||||||||||||||||||.................... 42.4%] Tasks: 114, 1 running
              </div>
              <div className="text-emerald-400 font-bold">
                RAM [|||||||||||||||||........................... 34.1%] 2.72 GiB / 8.00 GiB
              </div>
              <div className="text-slate-400 pt-1 border-t border-slate-800">
                PID  USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
              </div>
              <div className="text-emerald-300">412  root      20   0  142.4m  18.2m   8.1m S   6.2   0.2   1:14.22 wireguard-go</div>
              <div className="text-cyan-300">890  root     -51   0    0.0m   0.0m   0.0m S   4.1   0.0   0:48.10 [ebpf-sentinel]</div>
              <div className="text-slate-300">1024 operator  20   0  210.8m  44.1m  12.4m S   1.8   0.5   0:12.33 renumerate-ui</div>
            </div>
          );
          break;
        }

        case 'reboot': {
          output = (
            <div className="font-mono text-[11px] text-amber-400 space-y-0.5">
              <div>[  OK  ] Stopping WireGuard cryptographic overlay...</div>
              <div>[  OK  ] Purging nftables tables and rulesets...</div>
              <div>[  OK  ] Flushed routing cache and local DNS table.</div>
              <div>[  OK  ] Restarting eBPF kernel hooks...</div>
              <div className="text-emerald-400 font-bold">[  OK  ] Re-established secure tunnel with host. System ONLINE.</div>
            </div>
          );
          if (addLog) addLog('Sous-système réseau relancé depuis le Terminal SSH.', 'warning');
          break;
        }

        default: {
          isError = true;
          output = (
            <div className="text-rose-400 font-mono text-xs">
              bash: {cmd}: commande inconnue. Tapez <span className="underline font-bold text-white">help</span> pour voir la liste des commandes supportées.
            </div>
          );
          break;
        }
      }

      setHistory((prev) => [
        ...prev,
        {
          id: `cmd-${Date.now()}-${Math.random()}`,
          command: trimmed,
          output,
          timestamp,
          isError,
        },
      ]);

      setInputVal('');
    },
    [settings, currentIdentity, addLog]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    executeCommand(inputVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandLog.length === 0) return;
      const nextIdx =
        historyIndex === null
          ? commandLog.length - 1
          : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setInputVal(commandLog[nextIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === null) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx >= commandLog.length) {
        setHistoryIndex(null);
        setInputVal('');
      } else {
        setHistoryIndex(nextIdx);
        setInputVal(commandLog[nextIdx] || '');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const available = [
        'help',
        'ping',
        'traceroute',
        'mtr',
        'wg show',
        'nft list ruleset',
        'ss -tulpn',
        'sysctl -a',
        'pqc status',
        'ip link',
        'htop',
        'speedtest',
        'banner',
        'clear',
      ];
      const match = available.find((c) => c.startsWith(inputVal.trim().toLowerCase()));
      if (match) setInputVal(match);
    }
  };

  return (
    <div
      className={`bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col font-mono text-xs transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 rounded-2xl h-[calc(100vh-2rem)]' : 'h-[580px]'
      } ${className}`}
    >
      {/* Terminal Titlebar (SSH Session info & Controls) */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>

          <div className="flex items-center gap-2 text-slate-300 font-semibold text-xs">
            <TerminalIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-white">root@renumerate-wg0:~</span>
            <span className="hidden sm:inline text-slate-500">·</span>
            <span className="hidden sm:inline text-[11px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
              SSH-2.0-OpenSSH_9.7p1-PQC
            </span>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1.5 text-slate-400">
          <button
            type="button"
            onClick={() => setCrtEffect(!crtEffect)}
            className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
              crtEffect
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Activer/Désactiver le filtre cathodique CRT"
          >
            CRT
          </button>

          <button
            type="button"
            onClick={handleCopyLogs}
            className="p-1.5 rounded hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            title="Copier le tampon d'affichage"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 rounded hover:bg-slate-800 hover:text-rose-400 transition-colors cursor-pointer"
            title="Effacer l'écran (clear)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            title={isFullscreen ? 'Réduire la console' : 'Plein écran'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Quick Diagnostic Command Pills */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 py-2 flex flex-wrap items-center gap-1.5 overflow-x-auto shrink-0 select-none">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mr-1">Raccourcis :</span>
        {[
          { label: 'ping 1.1.1.1', cmd: 'ping 1.1.1.1' },
          { label: 'traceroute', cmd: 'traceroute 1.1.1.1' },
          { label: 'wg show', cmd: 'wg show' },
          { label: 'mtr', cmd: 'mtr 1.1.1.1' },
          { label: 'nft list', cmd: 'nft list ruleset' },
          { label: 'ss -tulpn', cmd: 'ss -tulpn' },
          { label: 'pqc status', cmd: 'pqc status' },
          { label: 'sysctl', cmd: 'sysctl' },
          { label: 'speedtest', cmd: 'speedtest' },
          { label: 'htop', cmd: 'htop' },
          { label: 'banner', cmd: 'banner' },
        ].map((item) => (
          <button
            key={item.cmd}
            type="button"
            onClick={() => executeCommand(item.cmd)}
            className="px-2 py-0.5 rounded text-[10px] bg-slate-800/80 hover:bg-cyan-950/80 text-slate-300 hover:text-cyan-300 border border-slate-700/60 hover:border-cyan-500/40 transition-colors cursor-pointer shrink-0"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Terminal Output Area */}
      <div
        ref={scrollContainerRef}
        onClick={() => inputRef.current?.focus()}
        className={`flex-1 p-4 overflow-y-auto space-y-4 cursor-text relative ${
          crtEffect ? 'bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]' : ''
        }`}
      >
        {history.map((entry) => (
          <div key={entry.id} className="space-y-1">
            <div className="flex items-center gap-2 text-slate-400">
              <span className="text-emerald-400 font-bold">root@renumerate-wg0</span>
              <span className="text-slate-500">:</span>
              <span className="text-cyan-400 font-bold">~</span>
              <span className="text-slate-500">#</span>
              <span className="text-white font-semibold">{entry.command}</span>
              <span className="text-[10px] text-slate-600 ml-auto hidden sm:inline">{entry.timestamp}</span>
            </div>
            <div className="pl-3 border-l-2 border-slate-800/80 pt-0.5">{entry.output}</div>
          </div>
        ))}

        {/* Active Command Input Line */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-1">
          <span className="text-emerald-400 font-bold select-none">root@renumerate-wg0</span>
          <span className="text-slate-500 select-none">:</span>
          <span className="text-cyan-400 font-bold select-none">~</span>
          <span className="text-slate-500 select-none">#</span>
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-white font-mono text-xs outline-none border-none p-0 focus:ring-0 placeholder:text-slate-600"
            placeholder="Tapez une commande (ex: help, ping, wg show, mtr, htop)..."
            autoFocus
            spellCheck={false}
            autoCapitalize="none"
          />
          <button
            type="submit"
            className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
            title="Exécuter (Entrée)"
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Terminal Status Footer */}
      <div className="bg-slate-900 border-t border-slate-800 px-4 py-1.5 flex flex-wrap items-center justify-between text-[10px] text-slate-500 select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>CONECTÉ (wg0 · BBR)</span>
          </span>
          <span className="text-slate-400 hidden sm:inline">IP: {currentIdentity.ip || '10.84.0.2'}</span>
          <span className="text-slate-400 hidden sm:inline">MTU: {settings.mtuSize}</span>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span className="text-slate-400 hidden md:inline">Ctrl+L : Clear · Tab : Complétion</span>
          <span className="text-cyan-400">PQC: {settings.postQuantumKex.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
};
