// Computer Use
export { bashSchema, executeBash } from "./computer-use.js";
export { lsSchema, executeLs } from "./computer-use.js";
export { findSchema, executeFind } from "./computer-use.js";
export { grepSchema, executeGrep } from "./computer-use.js";
export { readSchema, executeRead } from "./computer-use.js";

// Git
export { gitSchema, executeGit } from "./git.js";

// Docker
export { dockerSchema, executeDocker } from "./docker.js";

// Kubernetes
export { k8sSchema, executeK8s } from "./k8s.js";

// SSH
export { sshSchema, executeSsh } from "./ssh.js";

// HTTP
export { httpSchema, executeHttp } from "./http.js";

// AWS
export { awsSchema, executeAws } from "./aws.js";

// Terraform
export { terraformSchema, executeTerraform } from "./terraform.js";

// Database
export { dbSchema, executeDb } from "./db.js";

// Kafka
export { kafkaSchema, executeKafka } from "./kafka.js";

// Redis
export { redisSchema, executeRedis } from "./redis.js";

// Make
export { makeSchema, executeMake } from "./make.js";

// NPM
export { npmSchema, executeNpm } from "./npm.js";

// Systemctl
export { systemctlSchema, executeSystemctl } from "./systemctl.js";

// Sysctl
export { sysctlSchema, executeSysctl } from "./sysctl.js";

// Iptables
export { iptablesSchema, executeIptables } from "./iptables.js";

// Nft
export { nftSchema, executeNft } from "./nft.js";

// Lvm
export { lvmSchema, executeLvm } from "./lvm.js";

// Lsof
export { lsofSchema, executeLsof } from "./lsof.js";

// Pstree
export { pstreeSchema, executePstree } from "./pstree.js";

// Top
export { topSchema, executeTop } from "./top.js";

// Htop
export { htopSchema, executeHtop } from "./htop.js";

// Vmstat
export { vmstatSchema, executeVmstat } from "./vmstat.js";

// Mpstat
export { mpstatSchema, executeMpstat } from "./mpstat.js";

// Sar
export { sarSchema, executeSar } from "./sar.js";

// Mount
export { mountSchema, executeMount } from "./mount.js";

// Hardware
export { hardwareSchema, executeHardware } from "./hardware.js";

// Dmidecode
export { dmidecodeSchema, executeDmidecode } from "./dmidecode.js";

// Sensors
export { sensorsSchema, executeSensors } from "./sensors.js";

// Battery
export { batterySchema, executeBattery } from "./battery.js";

// Docker Compose
export { dockerComposeSchema, executeDockerCompose } from "./docker-compose.js";

// Podman
export { podmanSchema, executePodman } from "./podman.js";

// Kubectl Apply
export { kubectlApplySchema, executeKubectlApply } from "./kubectl-apply.js";

// Helm
export { helmSchema, executeHelm } from "./helm.js";

// Oc (OpenShift)
export { ocSchema, executeOc } from "./oc.js";

// Nomad
export { nomadSchema, executeNomad } from "./nomad.js";

// Vagrant
export { vagrantSchema, executeVagrant } from "./vagrant.js";

// Virsh (KVM)
export { virshSchema, executeVirsh } from "./virsh.js";

// QEMU
export { qemuSchema, executeQemu } from "./qemu.js";

// LXC/LXD
export { lxcSchema, executeLxc } from "./lxc.js";

// systemd-nspawn
export { systemdNspawnSchema, executeSystemdNspawn } from "./systemd-nspawn.js";

// chroot
export { chrootSchema, executeChroot } from "./chroot.js";

// Flatpak/Snap/AppImage
export { flatpakSchema, executeFlatpak } from "./flatpak.js";

// SQLite3
export { sqlite3Schema, executeSqlite3 } from "./sqlite3.js";

// MySQL
export { mysqlSchema, executeMysql } from "./mysql.js";

// PostgreSQL (psql)
export { psqlSchema, executePsql } from "./psql.js";

// MongoDB
export { mongodbSchema, executeMongodb } from "./mongodb.js";

// Kafka Console
export { kafkaConsoleSchema, executeKafkaConsole } from "./kafka-console.js";

// Python (pip/poetry/pipenv)
export { pipSchema, executePip } from "./pip.js";

// Rust (cargo/rustup)
export { cargoSchema, executeCargo } from "./cargo.js";

// Go (go/godoc)
export { goSchema, executeGo } from "./go.js";

// Java (mvn/gradle/ant)
export { mavenSchema, executeMaven } from "./maven.js";

// .NET (dotnet/msbuild)
export { dotnetSchema, executeDotnet } from "./dotnet.js";

// CMake/Ninja
export { cmakeSchema, executeCmake } from "./cmake.js";

// Yarn/PNPM
export { yarnSchema, executeYarn } from "./yarn.js";

// Deno/Bun
export { denoSchema, executeDeno } from "./deno.js";

// PHP/Composer
export { phpSchema, executePhp } from "./php.js";

// Ruby/Gem/Bundle
export { rubySchema, executeRuby } from "./ruby.js";

// Perl/CPAN
export { perlSchema, executePerl } from "./perl.js";

// Conda/Anaconda
export { condaSchema, executeConda } from "./conda.js";

// R/Rscript
export { rSchema, executeR } from "./r.js";

// Julia
export { juliaSchema, executeJulia } from "./julia.js";

// HTTPie
export { httpieSchema, executeHttpie } from "./httpie.js";

// Netcat
export { netcatSchema, executeNetcat } from "./netcat.js";

// Socat
export { socatSchema, executeSocat } from "./socat.js";

// SSH-Keygen
export { sshKeygenSchema, executeSshKeygen } from "./ssh-keygen.js";

// GPG
export { gpgSchema, executeGpg } from "./gpg.js";

// SFTP
export { sftpSchema, executeSftp } from "./sftp.js";

// FTP
export { ftpSchema, executeFtp } from "./ftp.js";

// SMBClient
export { smbclientSchema, executeSmbclient } from "./smbclient.js";

// Whois/DNS
export { whoisSchema, executeWhois } from "./whois.js";

// iftop/iptraf
export { iftopSchema, executeIftop } from "./iftop.js";

// Nethogs
export { nethogsSchema, executeNethogs } from "./nethogs.js";

// tcpdump
export { tcpdumpSchema, executeTcpdump } from "./tcpdump.js";

// Wireshark/Tshark
export { wiresharkSchema, executeWireshark } from "./wireshark.js";

// Benchmark (ab/wrk/bombardier)
export { benchmarkSchema, executeBenchmark } from "./benchmark.js";

// ImageMagick/GraphicsMagick
export { imagemagickSchema, executeImagemagick } from "./imagemagick.js";

// SoX (Audio)
export { soxSchema, executeSox } from "./sox.js";

// Pandoc
export { pandocSchema, executePandoc } from "./pandoc.js";

// wkhtmltopdf
export { wkhtmltopdfSchema, executeWkhtmltopdf } from "./wkhtmltopdf.js";

// pdftk/qpdf
export { pdftkSchema, executePdftk } from "./pdftk.js";

// ps2pdf/pdf2ps
export { ps2pdfSchema, executePs2pdf } from "./ps2pdf.js";

// enscript/a2ps
export { enscriptSchema, executeEnscript } from "./enscript.js";

// Graphviz
export { graphvizSchema, executeGraphviz } from "./graphviz.js";

// XMLStarlet
export { xmlstarletSchema, executeXmlstarlet } from "./xmlstarlet.js";

// json_pp/jsonschema
export { json_ppSchema, executeJson_pp } from "./json_pp.js";

// yamllint
export { yamllintSchema, executeYamllint } from "./yamllint.js";

// tomlq
export { tomlqSchema, executeTomlq } from "./tomlq.js";

// hjson
export { hjsonSchema, executeHjson } from "./hjson.js";

// archive (tar/gzip/bzip2)
export { archiveSchema, executeArchive } from "./archive.js";

// zip/unzip
export { zipSchema, executeZip } from "./zip.js";

// 7z
export { sevenZipSchema, execute7z } from "./7z.js";

// xz
export { xzSchema, executeXz } from "./xz.js";

// svn
export { svnSchema, executeSvn } from "./svn.js";

// Mercurial (hg)
export { hgSchema, executeHg } from "./hg.js";

// Darcs
export { darcsSchema, executeDarcs } from "./darcs.js";

// Fossil
export { fossilSchema, executeFossil } from "./fossil.js";

// Bazaar (bzr)
export { bzrSchema, executeBzr } from "./bzr.js";

// CVS
export { cvsSchema, executeCvs } from "./cvs.js";

// pacman (Arch Linux)
export { pacmanSchema, executePacman } from "./pacman.js";

// dnf (Fedora)
export { dnfSchema, executeDnf } from "./dnf.js";

// zypper (openSUSE)
export { zypperSchema, executeZypper } from "./zypper.js";

// emerge (Gentoo)
export { emergeSchema, executeEmerge } from "./emerge.js";

// apk (Alpine)
export { apkSchema, executeApk } from "./apk.js";

// pkg (FreeBSD)
export { pkgSchema, executePkg } from "./pkg.js";

// nix-env (Nix)
export { nixEnvSchema, executeNixEnv } from "./nix-env.js";

// guix (Guix)
export { guixSchema, executeGuix } from "./guix.js";

// spack (HPC)
export { spackSchema, executeSpack } from "./spack.js";

// pkgsrc
export { pkgsrcSchema, executePkgsrc } from "./pkgsrc.js";

// Journalctl
export { journalctlSchema, executeJournalctl } from "./journalctl.js";

// Ps
export { psSchema, executePs } from "./ps.js";

// Kill
export { killSchema, executeKill } from "./kill.js";

// Crontab
export { crontabSchema, executeCrontab } from "./crontab.js";

// Apt
export { aptSchema, executeApt } from "./apt.js";

// Yum
export { yumSchema, executeYum } from "./yum.js";

// Df
export { dfSchema, executeDf } from "./df.js";

// Du
export { duSchema, executeDu } from "./du.js";

// Ping
export { pingSchema, executePing } from "./ping.js";

// Traceroute
export { tracerouteSchema, executeTraceroute } from "./traceroute.js";

// Nslookup
export { nslookupSchema, executeNslookup } from "./nslookup.js";

// Dig
export { digSchema, executeDig } from "./dig.js";

// Wget
export { wgetSchema, executeWget } from "./wget.js";

// Tail
export { tailSchema, executeTail } from "./tail.js";

// Jq
export { jqSchema, executeJq } from "./jq.js";

// Yq
export { yqSchema, executeYq } from "./yq.js";

// Xmllint
export { xmllintSchema, executeXmllint } from "./xmllint.js";

// SCP
export { scpSchema, executeScp } from "./scp.js";

// Rsync
export { rsyncSchema, executeRsync } from "./rsync.js";

// FFmpeg
export { ffmpegSchema, executeFfmpeg } from "./ffmpeg.js";

// Update
export { updateSchema, executeUpdate } from "./update.js";

// Backup
export { backupSchema, executeBackup } from "./backup.js";

// Password
export { passwordSchema, executePassword } from "./password.js";

// Weather
export { weatherSchema, executeWeather } from "./weather.js";

// Time
export { timeSchema, executeTime } from "./time.js";

// UFW
export { ufwSchema, executeUfw } from "./ufw.js";

// At
export { atSchema, executeAt } from "./at.js";

// Quota
export { quotaSchema, executeQuota } from "./quota.js";

// ISO
export { isoSchema, executeIso } from "./iso.js";

// Free
export { freeSchema, executeFree } from "./free.js";

// Iostat
export { iostatSchema, executeIostat } from "./iostat.js";

// Netstat
export { netstatSchema, executeNetstat } from "./netstat.js";

// Ss
export { ssSchema, executeSs } from "./ss.js";
