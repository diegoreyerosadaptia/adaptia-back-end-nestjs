import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseAuthService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );
  }
  private supabaseAdmin(): SupabaseClient {
    return createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    )
  }
  private supabaseAnon(): SupabaseClient {
    return createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_ANON_KEY || "",
    )
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      throw new UnauthorizedException('❌ Credenciales inválidas');
    }

    return data;
  }

  async signUp(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (error || !data.user) {
      throw new UnauthorizedException('❌ Error al registrar usuario');
    }

    return data;
  }


  async updatePassword(
    userId: string,
    dto: { currentPassword: string; newPassword: string; repeatNewPassword: string },
    emailFromContext?: string, // ideal si ya lo tenés desde el guard
  ) {
    const { currentPassword, newPassword, repeatNewPassword } = dto

    if (newPassword !== repeatNewPassword) {
      throw new BadRequestException("Passwords do not match")
    }

    const admin = this.supabaseAdmin()

    // 1) Conseguir email del usuario
    let email = emailFromContext

    if (!email) {
      const { data, error } = await admin.auth.admin.getUserById(userId)

      if (error || !data?.user) {
        throw new NotFoundException("User not found")
      }

      email = data.user.email ?? undefined
    }

    if (!email) {
      throw new BadRequestException("User email not found")
    }

    // 2) Verificar current password (re-auth)
    const anon = this.supabaseAnon()
    const { data: signData, error: signErr } =
      await anon.auth.signInWithPassword({
        email,
        password: currentPassword,
      })

    if (signErr || !signData.user) {
      throw new BadRequestException({
        code: "CURRENT_PASSWORD_INCORRECT",
        message: "Current password is incorrect",
      })
    }

    // 3) Actualizar password con Admin API (server only)
    const { data: updated, error: updErr } =
      await admin.auth.admin.updateUserById(userId, {
        password: newPassword,
      })

    if (updErr || !updated?.user) {
      throw new BadRequestException("Could not update password")
    }

    return updated.user
  } 
}
