#!/usr/bin/env python3
"""Private operator SSH access. No connection is made by --check."""
import json, os, shlex, shutil, stat, subprocess, sys
from pathlib import Path

def control_path():
    ssh = Path.home() / '.ssh'
    def private_directory(path):
        s = path.lstat()
        if path.resolve() != path or not stat.S_ISDIR(s.st_mode) or s.st_uid != os.getuid() or stat.S_IMODE(s.st_mode) != 0o700:
            raise ValueError('Private owned SSH control directory required.')
    private_directory(ssh)
    directory = ssh / 'checkin-vps-control'
    try:
        directory.mkdir(mode=0o700)
    except FileExistsError:
        pass
    private_directory(directory)
    path = directory / 'root-24.199.121.72.sock'
    # macOS allows 103 pathname bytes; OpenSSH appends a 17-byte temp suffix.
    if len(os.fsencode(path)) > 86:
        raise ValueError('SSH control pathname is too long.')
    try:
        s = path.lstat()
    except FileNotFoundError:
        return path
    if not stat.S_ISSOCK(s.st_mode) or s.st_uid != os.getuid() or stat.S_IMODE(s.st_mode) != 0o600 or s.st_nlink != 1:
        raise ValueError('Private owned SSH control socket required.')
    return path

def main():
    root = Path(__file__).resolve().parents[1]
    path = root / '.env.vps.local'
    s = path.lstat()
    if not stat.S_ISREG(s.st_mode) or s.st_uid != os.getuid() or stat.S_IMODE(s.st_mode) != 0o600 or s.st_nlink != 1:
        raise ValueError('Private credential file must be an owned regular file with mode 0600.')
    if subprocess.run(['git', '-C', str(root), 'check-ignore', '--quiet', '--', '.env.vps.local']).returncode != 0:
        raise ValueError('Private credential file must be ignored.')
    if subprocess.run(['git', '-C', str(root), 'ls-files', '--error-unmatch', '--', '.env.vps.local'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
        raise ValueError('Private credential file must be untracked.')
    with path.open() as f:
        values = {}
        for line in f:
            key, raw = line.rstrip('\n').split('=', 1)
            if key in values:
                raise ValueError('Duplicate private configuration key.')
            values[key] = json.loads(raw)
    if set(values) != {'VPS_HOST', 'VPS_USER', 'VPS_PASS'} or values['VPS_HOST'] != '24.199.121.72' or values['VPS_USER'] != 'root' or not isinstance(values['VPS_PASS'], str) or not values['VPS_PASS']:
        raise ValueError('Unexpected private access configuration.')
    if sys.argv[1:] == ['--check']:
        print(json.dumps({'privateFileValid': True, 'ignored': True, 'tracked': False, 'networkUsed': False}))
        return 0
    if len(sys.argv) < 3 or sys.argv[1] != '--':
        raise ValueError('Use --check for offline validation, or -- followed by an authorized remote command.')
    if not shutil.which('sshpass'):
        raise ValueError('Existing sshpass executable is required.')
    socket = control_path()
    env = os.environ.copy()
    env.pop('VPS_PASS', None)
    env['SSHPASS'] = values['VPS_PASS']
    command = ['sshpass', '-e', 'ssh', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10', '-o', 'NumberOfPasswordPrompts=1', '-o', 'PreferredAuthentications=password', '-o', 'PubkeyAuthentication=no', '-o', 'ControlMaster=auto', '-o', 'ControlPersist=60', '-o', 'ControlPath='+str(socket), 'root@24.199.121.72', shlex.join(sys.argv[2:])]
    return subprocess.run(command, env=env).returncode

if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError):
        print('Private VPS access validation failed. Check docs/vps-access.md; no credential details are printed.', file=sys.stderr)
        raise SystemExit(2)
