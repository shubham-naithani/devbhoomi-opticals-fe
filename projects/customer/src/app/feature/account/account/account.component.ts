import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { AccountService, AuthService } from 'shared';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const newPass = control.get('newPassword')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return newPass && confirm && newPass !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent implements OnInit {
  private fb = inject(FormBuilder);
  private accountService = inject(AccountService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  isLoading = signal(true);
  isSavingProfile = signal(false);
  isSavingPassword = signal(false);
  profileError = signal('');
  passwordError = signal('');

  email = signal('');

  profileForm = this.fb.group({
    name: ['', Validators.required],
    phone: [''],
  });

  passwordForm = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch }
  );

  ngOnInit(): void {
    this.accountService.getMe().subscribe({
      next: ({ user }) => {
        this.email.set(user.email || '');
        this.profileForm.patchValue({ name: user.name, phone: user.phone || '' });
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.isSavingProfile.set(true);
    this.profileError.set('');

    const { name, phone } = this.profileForm.getRawValue();
    this.accountService.updateProfile({ name: name!, phone: phone || undefined }).subscribe({
      next: () => {
        this.isSavingProfile.set(false);
        this.snackBar.open('Details updated', undefined, { duration: 2500 });
      },
      error: (err) => {
        this.isSavingProfile.set(false);
        this.profileError.set(err?.error?.message || 'Could not update details.');
      },
    });
  }

  savePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.isSavingPassword.set(true);
    this.passwordError.set('');

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.accountService.changePassword(currentPassword!, newPassword!).subscribe({
      next: () => {
        this.isSavingPassword.set(false);
        this.passwordForm.reset();
        this.snackBar.open('Password updated', undefined, { duration: 2500 });
      },
      error: (err) => {
        this.isSavingPassword.set(false);
        this.passwordError.set(err?.error?.message || 'Could not update password.');
      },
    });
  }
}
