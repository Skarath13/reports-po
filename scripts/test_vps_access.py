import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shlex
import socket
import stat
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('vps_access', Path(__file__).with_name('vps-access.py'))
access = importlib.util.module_from_spec(spec)
spec.loader.exec_module(access)


class ControlPathTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir='/private/tmp')
        self.root = Path(self.temp.name).resolve()
        self.home = self.root / 'home'
        self.home.mkdir(mode=0o700)
        self.ssh = self.home / '.ssh'
        self.ssh.mkdir(mode=0o700)
        self.home_patch = patch.object(access.Path, 'home', return_value=self.home)
        self.home_patch.start()

    def tearDown(self):
        self.home_patch.stop()
        self.temp.cleanup()

    def test_private_directory_created_and_owned_socket_reused(self):
        path = access.control_path()
        self.assertEqual(path.name, 'root-24.199.121.72.sock')
        self.assertEqual(stat.S_IMODE(path.parent.stat().st_mode), 0o700)
        with socket.socket(socket.AF_UNIX) as local:
            local.bind(str(path))
            path.chmod(0o600)
            self.assertEqual(access.control_path(), path)

    def test_untrusted_directory_is_not_repaired_or_followed(self):
        directory = self.ssh / 'checkin-vps-control'
        directory.mkdir(mode=0o755)
        with self.assertRaises(ValueError): access.control_path()
        self.assertEqual(stat.S_IMODE(directory.stat().st_mode), 0o755)
        directory.rmdir()
        directory.symlink_to(self.home, target_is_directory=True)
        with self.assertRaises(ValueError): access.control_path()
        directory.unlink()
        with patch.object(access.os, 'getuid', return_value=os.getuid()+1):
            with self.assertRaises(ValueError): access.control_path()
        self.assertFalse(directory.exists())

    def test_wrong_mode_regular_file_and_symlink_socket_refused(self):
        path = access.control_path()
        path.write_text('unrelated')
        path.chmod(0o600)
        with self.assertRaises(ValueError): access.control_path()
        path.unlink()
        path.symlink_to(self.root / 'missing')
        with self.assertRaises(ValueError): access.control_path()
        path.unlink()
        with socket.socket(socket.AF_UNIX) as local:
            local.bind(str(path))
            path.chmod(0o666)
            with self.assertRaises(ValueError): access.control_path()


class CommandTests(unittest.TestCase):
    def invoke(self, argv, key=False):
        with tempfile.TemporaryDirectory(dir='/private/tmp') as temp:
            root = Path(temp).resolve()
            home = root/'home'
            (home/'.ssh').mkdir(parents=True, mode=0o700)
            (root/'scripts').mkdir()
            credential = root/'.env.vps.local'
            values = {'VPS_HOST':'24.199.121.72','VPS_USER':'root','VPS_PASS':'synthetic-password-only'}
            credential.write_text(''.join(k+'='+json.dumps(v)+'\n' for k,v in values.items()))
            credential.chmod(0o600)
            if key:
                control = home/'.ssh/checkin-vps-control'
                control.mkdir(mode=0o700)
                (control/'id_ed25519').write_text('synthetic-key')
                (control/'id_ed25519').chmod(0o600)
            calls = []
            def run(command, **kwargs):
                calls.append((command, kwargs))
                status = 1 if command[0]=='git' and 'ls-files' in command else 0
                return subprocess.CompletedProcess(command, status)
            with patch.object(access, '__file__', str(root/'scripts/vps-access.py')), patch.object(access.sys, 'argv', ['vps-access.py', *argv]), patch.object(access.Path, 'home', return_value=home), patch.object(access.subprocess, 'run', side_effect=run), patch.dict(access.os.environ, {'VPS_PASS':'ambient-must-not-leak'}), contextlib.redirect_stdout(io.StringIO()) as output:
                result = access.main()
            return result, calls, output.getvalue(), (home/'.ssh/checkin-vps-control').exists()

    def test_offline_check_has_no_ssh_or_directory_creation(self):
        result, calls, output, created = self.invoke(['--check'])
        self.assertEqual(result, 0)
        self.assertEqual(len(calls), 2)
        self.assertTrue(all(command[0]=='git' for command, _ in calls))
        self.assertFalse(created)
        self.assertFalse(json.loads(output)['networkUsed'])

    def test_one_ssh_process_reuses_private_control_and_preserves_security_and_quoting(self):
        remote = ['printf', '%s', '$(must-not-run)', "literal ' quote"]
        result, calls, _, created = self.invoke(['--', *remote], key=True)
        self.assertEqual(result, 0)
        self.assertTrue(created)
        self.assertEqual(len(calls), 3)  # Two existing git guards and one SSH command.
        command, kwargs = calls[-1]
        self.assertEqual(command[:2], ['ssh', '-i'])
        self.assertTrue(command[2].endswith('/.ssh/checkin-vps-control/id_ed25519'))
        self.assertEqual(command[-2], 'root@24.199.121.72')
        self.assertEqual(shlex.split(command[-1]), remote)
        options = [command[i+1] for i,v in enumerate(command[:-1]) if v=='-o']
        self.assertIn('StrictHostKeyChecking=yes', options)
        self.assertIn('PreferredAuthentications=publickey', options)
        self.assertIn('PasswordAuthentication=no', options)
        self.assertIn('IdentitiesOnly=yes', options)
        self.assertIn('BatchMode=yes', options)
        self.assertIn('ControlMaster=auto', options)
        self.assertIn('ControlPersist=60', options)
        self.assertEqual(sum(v.startswith('ControlPath=') for v in options), 1)
        self.assertFalse(any(v in command for v in ['-O', '-M', '-N', '-f']))
        self.assertNotIn('synthetic-password-only', str(command))
        self.assertNotIn('VPS_PASS', kwargs['env'])
        self.assertNotIn('SSHPASS', kwargs['env'])

    def test_missing_key_is_refused_before_any_ssh(self):
        with self.assertRaises((ValueError, OSError, getattr(access, 'AccessError', ValueError))):
            self.invoke(['--', 'true'])


if __name__ == '__main__':
    unittest.main()
