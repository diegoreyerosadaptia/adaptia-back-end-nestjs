import { Organization } from 'src/organizations/entities/organization.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const USER_ROLES = ['USER','ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 255, nullable:true })
  firstName: string;

  @Column('varchar', { length: 255, nullable:true })
  lastName: string;

  @Column('varchar', { length: 255, unique: true })
  @Index({ unique: true })
  email: string;

  @Column('varchar', { length: 255, nullable: true, select: false })
  password: string | null;

  @Column('enum', { enum: USER_ROLES, default: USER_ROLES[0] })
  role: UserRole;

  @OneToMany(() => Organization, (organization) => organization.owner, {
    onDelete: 'CASCADE',
  })
  organizations: Organization;

  @DeleteDateColumn()
  deletedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
